import '../scss/leaflet-measure.scss';
import template from 'lodash/template';

import units from './units';
import calc from './calc';
import * as dom from './dom';
import { selectOne as $ } from './dom';
import Symbology from './symbology';
import { numberFormat } from './utils';

import {
  controlTemplate,
  resultsTemplate,
  pointPopupTemplate,
  linePopupTemplate,
  areaPopupTemplate
} from './templates';

// 🔹 Translations for Portuguese
const lang = {
  "measure": "Medir distância",
  "start": "Clique para iniciar a medição",
  "cont": "Clique para continuar medindo",
  "end": "Clique para finalizar a medição",
  "unit": "Unidades",
  "km": "km",
  "m": "m",
  "mi": "milhas",
  "ft": "pés",
  "totalDistance": "Distância Total:",
  "totalArea": "Área Total:",
  "doubleClick": "Clique duas vezes para finalizar",
  "delete": "Excluir medição"
};

const templateSettings = {
  imports: { numberFormat },
  interpolate: /{{([\s\S]+?)}}/g // mustache
};

const controlTemplateCompiled = template(controlTemplate, templateSettings);
const resultsTemplateCompiled = template(resultsTemplate, templateSettings);
const pointPopupTemplateCompiled = template(pointPopupTemplate, templateSettings);
const linePopupTemplateCompiled = template(linePopupTemplate, templateSettings);
const areaPopupTemplateCompiled = template(areaPopupTemplate, templateSettings);

L.Control.Measure = L.Control.extend({
  _className: 'leaflet-control-measure',
  options: {
    units: {},
    position: 'topright',
    primaryLengthUnit: 'kilometers',
    secondaryLengthUnit: 'meters',
    primaryAreaUnit: 'hectares',
    activeColor: '#ABE67E', 
    completedColor: '#C8F2BE', 
    captureZIndex: 10000, 
    popupOptions: {
      className: 'leaflet-measure-resultpopup',
      autoPanPadding: [10, 10]
    }
  },
  initialize: function(options) {
    L.setOptions(this, options);
    const { activeColor, completedColor } = this.options;
    this._symbols = new Symbology({ activeColor, completedColor });
    this.options.units = L.extend({}, units, this.options.units);
  },
  onAdd: function(map) {
    this._map = map;
    this._latlngs = [];
    this._initLayout();
    map.on('click', this._collapse, this);
    this._layer = L.layerGroup().addTo(map);
    return this._container;
  },
  onRemove: function(map) {
    map.off('click', this._collapse, this);
    map.removeLayer(this._layer);
  },
  _initLayout: function() {
    const className = this._className,
      container = (this._container = L.DomUtil.create('div', `${className} leaflet-bar`));

    container.innerHTML = controlTemplateCompiled({
      model: {
        className: className
      }
    });

    container.setAttribute('aria-haspopup', true);
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    const $toggle = (this.$toggle = $('.js-toggle', container));
    this.$interaction = $('.js-interaction', container);
    const $start = $('.js-start', container);
    const $cancel = $('.js-cancel', container);
    const $finish = $('.js-finish', container);
    this.$startPrompt = $('.js-startprompt', container);
    this.$measuringPrompt = $('.js-measuringprompt', container);
    this.$startHelp = $('.js-starthelp', container);
    this.$results = $('.js-results', container);
    this.$measureTasks = $('.js-measuretasks', container);

    this._collapse();
    this._updateMeasureNotStarted();

    if (!L.Browser.android) {
      L.DomEvent.on(container, 'mouseenter', this._expand, this);
      L.DomEvent.on(container, 'mouseleave', this._collapse, this);
    }
    L.DomEvent.on($toggle, 'click', L.DomEvent.stop);
    if (L.Browser.touch) {
      L.DomEvent.on($toggle, 'click', this._expand, this);
    } else {
      L.DomEvent.on($toggle, 'focus', this._expand, this);
    }
    L.DomEvent.on($start, 'click', L.DomEvent.stop);
    L.DomEvent.on($start, 'click', this._startMeasure, this);
    L.DomEvent.on($cancel, 'click', L.DomEvent.stop);
    L.DomEvent.on($cancel, 'click', this._finishMeasure, this);
    L.DomEvent.on($finish, 'click', L.DomEvent.stop);
    L.DomEvent.on($finish, 'click', this._handleMeasureDoubleClick, this);
  },
  _expand: function() {
    dom.hide(this.$toggle);
    dom.show(this.$interaction);
  },
  _collapse: function() {
    if (!this._locked) {
      dom.hide(this.$interaction);
      dom.show(this.$toggle);
    }
  },
  _updateMeasureNotStarted: function() {
    dom.hide(this.$startHelp);
    dom.hide(this.$results);
    dom.hide(this.$measureTasks);
    dom.hide(this.$measuringPrompt);
    dom.show(this.$startPrompt);
  },
  _startMeasure: function() {
    this._locked = true;
    this._measureVertexes = L.featureGroup().addTo(this._layer);
    this._captureMarker = L.marker(this._map.getCenter(), {
      clickable: true,
      zIndexOffset: this.options.captureZIndex,
      opacity: 0
    }).addTo(this._layer);
    this._setCaptureMarkerIcon();
    this._updateMeasureStartedNoPoints();

    this._map.fire('measurestart', null, false);
  },
  _finishMeasure: function() {
    const model = L.extend({}, this._resultsModel, { points: this._latlngs });

    this._locked = false;
    this._clearMeasure();
    this._updateMeasureNotStarted();
    this._collapse();

    this._map.fire('measurefinish', model, false);
  },
  _clearMeasure: function() {
    this._latlngs = [];
    this._resultsModel = null;
    this._measureVertexes.clearLayers();
  },
  _handleMeasureClick: function(evt) {
    const latlng = this._map.mouseEventToLatLng(evt.originalEvent);
    let lastClick = this._latlngs[this._latlngs.length - 1];

    if (!lastClick || !latlng.equals(lastClick)) {
      this._latlngs.push(latlng);
      this._addMeasureBoundary(this._latlngs);
      this._updateResults();
      this._updateMeasureStartedWithPoints();
    }
  },
  _updateResults: function() {
    const calced = calc(this._latlngs);
    const model = (this._resultsModel = L.extend({}, calced, this._getMeasurementDisplayStrings(calced)));
    this.$results.innerHTML = resultsTemplateCompiled({ model });
  },
  _getMeasurementDisplayStrings: function(measurement) {
    return {
      lengthDisplay: `${measurement.length.toFixed(2)} ${lang.km}`,
      areaDisplay: `${measurement.area.toFixed(2)} ${lang.totalArea}`
    };
  }
});

L.Map.mergeOptions({
  measureControl: false
});

L.Map.addInitHook(function() {
  if (this.options.measureControl) {
    this.measureControl = new L.Control.Measure().addTo(this);
  }
});

L.control.measure = function(options) {
  return new L.Control.Measure(options);
};
