// 🔹 Define Projection (UTM 36S to WGS84)
proj4.defs("EPSG:32736", "+proj=utm +zone=36 +south +datum=WGS84 +units=m +no_defs");

// 🔹 Initialize Leaflet Map
document.addEventListener("DOMContentLoaded", function () {

    //✅ Ensure Leaflet is Loaded
    if (typeof L === "undefined") {
        console.error("❌ Leaflet is not loaded!");
        return;
    }


    var map = L.map("map").setView([-25.9292, 32.5732], 12); // Centered in Mozambique
 
    map.options.minZoom = 6; // Prevent excessive zooming out

    // 🔹 Define Tile Layers
    var grayscaleBasemap = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap & CartoDB contributors",
        subdomains: "abcd",
        maxZoom: 20,
    });

    var satelliteBasemap = L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        attribution: "&copy; Google Maps",
        maxZoom: 20,
    });

    // 🔹 Add Default Basemap (Grayscale)
    grayscaleBasemap.addTo(map);
    var baseMaps = {
        "🟠 Grayscale": grayscaleBasemap,
        "🌍 Satellite": satelliteBasemap
    };

    L.control.layers(baseMaps, {}, { position: "topleft" }).addTo(map);
    L.control.scale({ position: "bottomright" }).addTo(map);

    // ✅ Ensure Leaflet is Loaded
    if (typeof L === "undefined") {
        console.error("❌ Leaflet is not loaded!");
    } 

    // ✅ Initialize the Measure Control
    var measureControl = new L.Control.Measure({
        primaryLengthUnit: "kilometers", // Unidade principal: KM
        secondaryLengthUnit: "meters",   // Unidade secundária: M
        primaryAreaUnit: "sqmeters",     // Área principal: m²
        secondaryAreaUnit: "hectares",   // Área secundária: Hectares
        activeColor: "#FF0000",          // Cor da linha ativa
        completedColor: "#00FF00",       // Cor da linha finalizada
        position: "topleft",   
        localization: "pt",         // Localização no mapa
    });

    // ✅ Add the Measure Control to the Map
    map.addControl(measureControl);


    // 🔹 Add North Arrow
    var northControl = L.control({ position: "bottomleft" });
    northControl.onAdd = function () {
        var div = L.DomUtil.create("div", "north-arrow");
        div.innerHTML = "<img src='https://www.svgrepo.com/show/399195/north-arrow-n.svg' style='width:50px; opacity: 0.8;' title='North'>";
        return div;
    };
    northControl.addTo(map);

    // 🔹 Layers for Routes and Stops
    var routesLayer = L.layerGroup().addTo(map);
    var stopsLayer = L.layerGroup().addTo(map);
    var allStopsGeoJSON;






    
    // 🔹 Ensure Sidebar Expanded on Load
    document.getElementById("routes-container").style.display = "block";
    
    // 🔹 Load Chapas Routes from GeoJSON
    fetch("./data/rotas_chapas1.geojson")
        .then(response => response.json())
        .then(routesGeoJSON => {
            console.log("✅ Loaded Chapas Routes:", routesGeoJSON);

            // Convert UTM to Lat/Lon
            routesGeoJSON.features.forEach(feature => {
                if (feature.geometry.type === "MultiLineString") {
                    feature.geometry.coordinates = feature.geometry.coordinates.map(line =>
                        line.map(coord => proj4("EPSG:32736", "EPSG:4326", [coord[0], coord[1]]))
                    );
                }
            });

            // Extract unique routes
            let uniqueRoutes = new Set(routesGeoJSON.features.map(feature => feature.properties.name_2));
            let sortedRoutes = [...uniqueRoutes].sort();

            var routesContainer = document.getElementById("routes-container");
            routesContainer.innerHTML = ""; // Clear existing

            // ✅ Auto-load and check all Chapas routes
            sortedRoutes.forEach(routeName => {
                let checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.classList.add("route-filter");
                checkbox.value = routeName;
                checkbox.checked = true; // ✅ Default: All routes checked
                checkbox.addEventListener("change", applyFilters);

                let label = document.createElement("label");
                label.textContent = routeName;

                routesContainer.appendChild(checkbox);
                routesContainer.appendChild(label);
                routesContainer.appendChild(document.createElement("br"));
            });

            // ✅ Save dataset & Show all routes initially
            window.allRoutesGeoJSON = routesGeoJSON;
            updateMap(routesGeoJSON.features);
            updateStats(sortedRoutes);
        })
        .catch(error => console.error("❌ Error loading GeoJSON:", error));

    // 🔹 Load Bus Stops
    fetch("./data/paragens_chapas_maputo.geojson")
        .then(response => response.json())
        .then(busStopsGeoJSON => {
            console.log("✅ Loaded Bus Stops:", busStopsGeoJSON);

            // Convert UTM to Lat/Lon
            busStopsGeoJSON.features.forEach(feature => {
                if (feature.geometry.type === "MultiPoint") {
                    feature.geometry.type = "Point";
                    feature.geometry.coordinates = proj4("EPSG:32736", "EPSG:4326", feature.geometry.coordinates[0]);
                }
            });

            allStopsGeoJSON = busStopsGeoJSON;
            updateStops(window.allRoutesGeoJSON ? Object.keys(window.allRoutesGeoJSON.features) : []);
        })
        .catch(error => console.error("❌ Error loading Bus Stops:", error));

    // 🔹 Update Map with Routes
    function updateMap(filteredRoutes) {
        routesLayer.clearLayers();
        L.geoJSON(filteredRoutes, {
            style: { color: "#FF5733", weight: 4 },
            onEachFeature: function (feature, layer) {
                layer.bindPopup(`<b>${feature.properties.name_2}</b>`);
            }
        }).addTo(routesLayer);
    }

    // 🔹 Update Stops
    function updateStops(selectedRoutes) {
        stopsLayer.clearLayers();
        if (!allStopsGeoJSON) return;

        var filteredStops = allStopsGeoJSON.features.filter(stop =>
            stop.properties.name_2_2 && selectedRoutes.some(route => stop.properties.name_2_2.includes(route))
        );

        console.log("🚏 Filtered Stops:", filteredStops.length);

        L.geoJSON(filteredStops, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 5,
                    fillColor: "#0088FF",
                    color: "#0055AA",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function (feature, layer) {
                let stopName = feature.properties.name || "Paragem sem nome";
                layer.bindPopup(`<b>Paragem:</b> ${stopName}`);

                let tooltip = L.tooltip({
                    permanent: map.getZoom() > 14,
                    direction: "top",
                    offset: [0, -8],
                    className: "bus-stop-label"
                }).setContent(stopName);
                layer.bindTooltip(tooltip);
            }
        }).addTo(stopsLayer);

        // ✅ Toggle Labels Dynamically
        map.on("zoomend", function () {
            let currentZoom = map.getZoom();
            stopsLayer.eachLayer(layer => {
                let tooltip = layer.getTooltip();
                if (tooltip) {
                    tooltip.options.permanent = currentZoom > 14;
                    layer.unbindTooltip().bindTooltip(tooltip).openTooltip();
                }
            });
        });
    }

    // 🔹 Function to update statistics
    function updateStats(selectedRoutes) {
        let totalRoutes = window.allRoutesGeoJSON ? new Set(window.allRoutesGeoJSON.features.map(route => route.properties.name_2)).size : 0;
        document.getElementById("total-routes").innerText = totalRoutes;
        document.getElementById("selected-routes-count").innerText = selectedRoutes.length;
        document.getElementById("selected-route").innerText = selectedRoutes.length > 1 ? "Várias rotas" : selectedRoutes[0] || "Nenhuma";
    }

    // 🔹 Auto-Filter
    function applyFilters() {
        var selectedRoutes = [...document.querySelectorAll(".route-filter:checked")].map(cb => cb.value);
        if (selectedRoutes.length === 0) {
            updateStats([]); // ✅ Reset stats
            return;
        }

        var filteredRoutes = window.allRoutesGeoJSON.features.filter(route =>
            selectedRoutes.includes(route.properties.name_2)
        );

        updateMap(filteredRoutes);
        updateStops(selectedRoutes);
        updateStats(selectedRoutes);
    }

    // 🔹 Select All / Unselect All Chapas
    document.getElementById("check-chapas").addEventListener("change", function () {
        document.querySelectorAll("#routes-container input[type='checkbox']").forEach(cb => cb.checked = this.checked);
        applyFilters();
    });

}); 

