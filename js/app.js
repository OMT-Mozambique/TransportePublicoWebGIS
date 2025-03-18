proj4.defs("EPSG:32736", "+proj=utm +zone=36 +south +datum=WGS84 +units=m +no_defs");

document.addEventListener("DOMContentLoaded", function () {
    if (typeof L === "undefined") return console.error("❌ Leaflet not loaded!");

    const map = L.map("map").setView([-25.9292, 32.5732], 12);
    map.options.minZoom = 6;

    const grayscale = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap & CartoDB contributors", subdomains: "abcd", maxZoom: 20,
    }).addTo(map);

    const satellite = L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        subdomains: ["mt0", "mt1", "mt2", "mt3"], attribution: "&copy; Google Maps", maxZoom: 20,
    });

    L.control.layers({ "🟠 Grayscale": grayscale, "🌍 Satellite": satellite }, {}, { position: "topleft" }).addTo(map);
    L.control.scale({ position: "bottomright" }).addTo(map);

    const measureControl = new L.Control.Measure({
        primaryLengthUnit: "kilometers", secondaryLengthUnit: "meters",
        primaryAreaUnit: "sqmeters", secondaryAreaUnit: "hectares",
        activeColor: "#FF0000", completedColor: "#00FF00", position: "topleft", localization: "pt",
    });
    map.addControl(measureControl);

    const districtsLayer = L.layerGroup().addTo(map);
    const routesLayer = L.layerGroup().addTo(map);
    const stopsLayer = L.layerGroup().addTo(map);

    let allRoutesGeoJSON, allStopsGeoJSON;
    const stopsContainer = document.getElementById("stops-container");
    const districtContainer = document.getElementById("district-container");
    const routesContainer = document.getElementById("routes-container");
    const horarioContainer = document.getElementById("horario-container");
    const operadorContainer = document.getElementById("operador-container");

    Promise.all([
        fetch("./data/rotas_chapas2.geojson").then(res => res.json()),
        fetch("./data/paragens_chapas_maputo.geojson").then(res => res.json())
    ]).then(([routesGeoJSON, stopsGeoJSON]) => {
        // Reproject routes
        routesGeoJSON.features.forEach(f => {
            if (f.geometry.type === "MultiLineString") {
                f.geometry.coordinates = f.geometry.coordinates.map(line =>
                    line.map(coord => proj4("EPSG:32736", "EPSG:4326", coord))
                );
            }
        });
    
        allRoutesGeoJSON = routesGeoJSON;
    
        // Reproject stops
        stopsGeoJSON.features.forEach(f => {
            if (f.geometry.type === "MultiPoint") {
                f.geometry.type = "Point";
                f.geometry.coordinates = proj4("EPSG:32736", "EPSG:4326", f.geometry.coordinates[0]);
            }
        });
    
        allStopsGeoJSON = stopsGeoJSON;
    
        initializeFilters();
        updateMapLayers();
    });
    

    function initializeFilters() {
        const allStops = new Set(allStopsGeoJSON.features.map(f => f.properties.name));
        createFilterUI(stopsContainer, "stops", "stop-filter", allStops);

        const allDistricts = new Set(allRoutesGeoJSON.features.map(f => f.properties.area));
        createFilterUI(districtContainer, "districts", "district-filter", allDistricts);

        const allRoutes = new Set(allRoutesGeoJSON.features.map(f => f.properties.name_2));
        createFilterUI(routesContainer, "routes", "route-filter", allRoutes);

        const horarios = new Set(allRoutesGeoJSON.features.map(f => f.properties.opening_ho));
        createFilterUI(horarioContainer, "horario", "horario-filter", horarios);

        const operadores = new Set(allRoutesGeoJSON.features.map(f => f.properties.route));
        createFilterUI(operadorContainer, "operador", "operador-filter", operadores);

        // Tarifa filter change triggers map update
        document.getElementById("tarifa-filter").addEventListener("change", updateMapLayers);
        document.getElementById("tarifa-value").addEventListener("input", updateMapLayers);

        // Distância filter change triggers map update
        document.getElementById("distance-filter").addEventListener("change", updateMapLayers);
        document.getElementById("distance-value").addEventListener("input", updateMapLayers);

    }

    function createFilterUI(container, category, className, valuesSet) {
        container.innerHTML = "";
        container.appendChild(createSelectAllCheckbox(category, className));
        valuesSet.forEach(value => {
            if (!value) return;
            const checkboxDiv = createCheckbox(value, className);
            container.appendChild(checkboxDiv);
        });
        updateSelectAllCheckboxState(className, category);

        
    }

    function createSelectAllCheckbox(category, className) {
        const div = document.createElement("div");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `${category}-select-all`;
        checkbox.classList.add(`${category}-select-all`);
        checkbox.checked = true;

        const label = document.createElement("label");
        label.htmlFor = checkbox.id;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(" Selecionar/desselecionar Todas"));
        div.appendChild(label);

        checkbox.addEventListener("change", () => {
            const isChecked = checkbox.checked;
            document.querySelectorAll(`.${className}`).forEach(cb => cb.checked = isChecked);
            updateMapLayers();
        });

        return div;
    }

    function createCheckbox(value, className) {
        const div = document.createElement("div");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.classList.add(className);
        checkbox.value = value;
        checkbox.checked = true;

        const label = document.createElement("label");
        label.textContent = value;
        div.appendChild(checkbox);
        div.appendChild(label);

        checkbox.addEventListener("change", () => {
            updateSelectAllCheckboxState(className, className.split("-")[0]);
            updateMapLayers();
        });

        return div;
    }

    function updateSelectAllCheckboxState(className, category) {
        const allCheckboxes = document.querySelectorAll(`.${className}`);
        const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
        const selectAll = document.getElementById(`${category}-select-all`);
        if (selectAll) selectAll.checked = allChecked;
    }

    function populateStopsFilter() {
        const selectedRoutes = [...document.querySelectorAll(".route-filter:checked")].map(cb => cb.value);
        const stopSet = new Set();
        allStopsGeoJSON.features.forEach(f => {
            if (selectedRoutes.includes(f.properties.name_2_2)) {
                stopSet.add(f.properties.name);
            }
        });
        createFilterUI(stopsContainer, "stops", "stop-filter", stopSet);
    }

    function updateMapLayers() {
        const selectedDistricts = [...document.querySelectorAll(".district-filter:checked")].map(cb => cb.value);
        const selectedRoutes = [...document.querySelectorAll(".route-filter:checked")].map(cb => cb.value);
        const selectedHorarios = [...document.querySelectorAll(".horario-filter:checked")].map(cb => cb.value);
        const selectedOperadores = [...document.querySelectorAll(".operador-filter:checked")].map(cb => cb.value);

        const tarifaCondition = document.getElementById("tarifa-filter").value;
        const tarifaValue = parseFloat(document.getElementById("tarifa-value").value);
        const distanciaCondition = document.getElementById("distance-filter").value;
        const distanciaValue = parseFloat(document.getElementById("distance-value").value);

        const filteredRoutes = allRoutesGeoJSON.features.filter(f => {
            const props = f.properties;

            if (!selectedDistricts.includes(props.area)) return false;
            if (!selectedRoutes.includes(props.name_2)) return false;
            if (!selectedHorarios.includes(props.opening_ho)) return false;
            if (!selectedOperadores.includes(props.route)) return false;

            // Clean and convert Tarifa
            const tarifa = convertToNumber(props.fare);
            if (!applyNumericFilter(tarifa, tarifaCondition, tarifaValue)) return false;

            // Clean and convert Distância
            const distancia = convertToNumber(props.dist_km);
            if (!applyNumericFilter(distancia, distanciaCondition, distanciaValue)) return false;

            return true;
        });

        const routeNames = new Set(filteredRoutes.map(f => f.properties.name_2));
        const filteredStops = allStopsGeoJSON.features.filter(f =>
            routeNames.has(f.properties.name_2_2)
        );

        populateStopsFilter();
        zoomToLayer(filteredRoutes);
        updateMap(filteredRoutes);
        updateStops(filteredStops);
        updateStats(filteredRoutes, filteredStops);


    }

    // 🔹 Clean and Convert String (e.g., "50 MZN") to Number
    function convertToNumber(rawValue) {
        if (!rawValue) return NaN;
        if (typeof rawValue === "number") return rawValue;
        const cleaned = rawValue.toString().replace(/[^\d.]/g, "");
        return parseFloat(cleaned);
    }

    function applyNumericFilter(fieldValue, condition, filterValue) {
        if (!condition || isNaN(filterValue)) return true;
        if (isNaN(fieldValue)) return false;
        switch (condition) {
            case "less": return fieldValue < filterValue;
            case "equal": return fieldValue === filterValue;
            case "greater": return fieldValue > filterValue;
            default: return true;
        }
    }

    function updateStats(filteredRoutes, filteredStops) {
        console.log("📊 Atualizando estatísticas para:", filteredRoutes.length, "rotas");
    
        // Total unique rotas in ALL data
        const totalUniqueRotas = new Set(allRoutesGeoJSON.features.map(f => f.properties.name_2)).size;
        document.getElementById("unique-routes-count").innerText = totalUniqueRotas;
    
        // Unique rotas in FILTERED data
        const uniqueRouteNames = new Set(filteredRoutes.map(f => f.properties.name_2));
        document.getElementById("selected-routes-count").innerText = uniqueRouteNames.size;
    
        // Nome da rota selecionada
        if (uniqueRouteNames.size === 1) {
            document.getElementById("selected-route").innerText = [...uniqueRouteNames][0];
        } else if (uniqueRouteNames.size > 1) {
            document.getElementById("selected-route").innerText = "Multiplas rotas selecionadas";
        } else {
            document.getElementById("selected-route").innerText = "Nenhuma rota selecionada";
        }
    
        // Initialize sums
        let inboundDistance = 0, outboundDistance = 0;
        let inboundStops = 0, outboundStops = 0;
        let inboundOperators = new Set(), outboundOperators = new Set();
    
        filteredRoutes.forEach(route => {
            const props = route.properties;
            const direction = String(props.direction); // "1" = Ida, "2" = Volta
            const distance = convertToNumber(props.dist_km);
    
            // Count stops for this route
            const stopsForRoute = filteredStops.filter(stop =>
                stop.properties.name_2_2 === props.name_2 ||
                (stop.properties.route_ref && stop.properties.route_ref.includes(props.name_2))
            ).length;
    
            if (direction === "1") {
                inboundDistance += distance;
                inboundStops += stopsForRoute;
                if (props.network) inboundOperators.add(props.network);
            } else if (direction === "2") {
                outboundDistance += distance;
                outboundStops += stopsForRoute;
                if (props.network) outboundOperators.add(props.network);
            }
        });
    
        // Calculate estimated time: assuming 20 km/h
        const inboundTime = Math.round(inboundDistance / 20 * 60);
        const outboundTime = Math.round(outboundDistance / 20 * 60);
    
        // Update Stats Panel
        document.getElementById("inbound-distance").innerText = inboundDistance.toFixed(2);
        document.getElementById("outbound-distance").innerText = outboundDistance.toFixed(2);
    
        document.getElementById("inbound-stops").innerText = inboundStops;
        document.getElementById("outbound-stops").innerText = outboundStops;
    
        document.getElementById("inbound-travel-time").innerText = inboundTime;
        document.getElementById("outbound-travel-time").innerText = outboundTime;
    
        const allOperators = new Set([...inboundOperators, ...outboundOperators]);
        if (allOperators.size === 0) {
            document.getElementById("route-operator").innerText = "N/A";
        } else if (allOperators.size === 1) {
            document.getElementById("route-operator").innerText = [...allOperators][0];
        } else {
            document.getElementById("route-operator").innerText = "Vários operadores";
        }
    }
    

    function updateStops(features) {
        stopsLayer.clearLayers();
        L.geoJSON(features, {
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                radius: 5, fillColor: "#0088FF", color: "#0055AA", weight: 1, opacity: 1, fillOpacity: 0.8
            })
        }).addTo(stopsLayer);
    }

    function updateMap(features) {
        routesLayer.clearLayers();
        L.geoJSON(features, { style: { color: "#FF5733", weight: 4 } }).addTo(routesLayer);
    }

    function zoomToLayer(features) {
        if (features.length) {
            const bounds = L.geoJSON(features).getBounds();
            if (bounds.isValid()) map.fitBounds(bounds);
        }
    }
});
