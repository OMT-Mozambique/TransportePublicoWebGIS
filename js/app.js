// 🔹 Define Projection (UTM 36S to WGS84)
proj4.defs("EPSG:32736", "+proj=utm +zone=36 +south +datum=WGS84 +units=m +no_defs");

// 🔹 Initialize Leaflet Map
document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map").setView([-25.9692, 32.5732], 12); // Centered in Mozambique

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

    // 🔹 Basemap Control
    var baseMaps = {
        "🟠 Grayscale": grayscaleBasemap,
        "🌍 Satellite": satelliteBasemap
    };
    L.control.layers(baseMaps).addTo(map);
    L.control.scale({ position: "bottomright" }).addTo(map);

    // 🔹 Add North Arrow
    var northControl = L.control({ position: "bottomright" });
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
            let uniqueRoutes = new Set();
            routesGeoJSON.features.forEach(feature => uniqueRoutes.add(feature.properties.name_2));
            let sortedRoutes = [...uniqueRoutes].sort();

            var routesContainer = document.getElementById("routes-container");
            routesContainer.innerHTML = ""; // Clear existing

            // ✅ Auto-load and check all Chapas routes
            sortedRoutes.forEach(routeName => {
                let checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.classList.add("route-filter");
                checkbox.value = routeName;
                checkbox.checked = true; // ✅ Ensure all routes are checked on load
                checkbox.addEventListener("change", applyFilters);

                let label = document.createElement("label");
                label.textContent = routeName;

                routesContainer.appendChild(checkbox);
                routesContainer.appendChild(label);
                routesContainer.appendChild(document.createElement("br"));
            });

            // ✅ Save full dataset and Show all routes initially
            window.allRoutesGeoJSON = routesGeoJSON;
            updateMap(routesGeoJSON.features);
            updateStats(routesGeoJSON.features);
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
            }
        }).addTo(stopsLayer);
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
        routesLayer.clearLayers();
        stopsLayer.clearLayers();

        var selectedRoutes = [...document.querySelectorAll(".route-filter:checked")].map(cb => cb.value);
        console.log("🔍 Selected Routes:", selectedRoutes);

        if (selectedRoutes.length === 0) {
            updateStats([]); // ✅ Reset stats when no routes selected
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
