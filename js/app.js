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

    var coll = document.getElementsByClassName("collapsible");

        for (let i = 0; i < coll.length; i++) {
            coll[i].addEventListener("click", function () {
                this.classList.toggle("active");
                var content = this.nextElementSibling;
                if (content.style.display === "block") {
                    content.style.display = "none";
                } else {
                    content.style.display = "block";
                }
            });
        }

    L.control.layers(baseMaps).addTo(map); // Adds control to toggle basemaps
    L.control.scale({position: 'bottomright' }).addTo(map);

    // 🔹 Add North Arrow at Bottom Right
    var northControl = L.control({ position: "bottomright" });

    northControl.onAdd = function () {
        var div = L.DomUtil.create("div", "north-arrow");
        div.innerHTML = "<img src='https://www.svgrepo.com/show/399195/north-arrow-n.svg' style='width:50px; transform: rotate(0deg); opacity: 0.8;' title='North'>";
        return div;
    };
    northControl.addTo(map);

  




    // 🔹 Load Routes from GeoJSON
    var routesLayer = L.layerGroup().addTo(map); // Holds displayed routes
    var stopsLayer = L.layerGroup().addTo(map);  // Holds displayed bus stops
    var allStopsGeoJSON;  // Stores all bus stops data


    fetch("./data/rotas_chapas1.geojson")
    .then((response) => response.json())
    .then((routesGeoJSON) => {
        console.log("✅ Loaded GeoJSON:", routesGeoJSON);

        // 🔹 Convert UTM coordinates to Lat/Lon
        routesGeoJSON.features.forEach((feature) => {
            if (feature.geometry.type === "MultiLineString") {
                feature.geometry.coordinates = feature.geometry.coordinates.map((line) =>
                    line.map((coord) => proj4("EPSG:32736", "EPSG:4326", [coord[0], coord[1]]))
                );
            }
        });

        // 🔹 Get Unique Routes (Remove Duplicates Caused by Direction 1 & 2)
        let uniqueRoutes = new Set();

        routesGeoJSON.features.forEach((feature) => {
            let routeName = feature.properties.name_2;
            if (!routeName) return;
            uniqueRoutes.add(routeName); // ✅ Only store unique route names
        });

        // 🔹 Sort Routes Alphabetically
        let sortedRoutes = [...uniqueRoutes].sort();

        // 🔹 Populate Sidebar with Unique Routes (Checkbox Logic Remains the Same)
        var routesContainer = document.getElementById("routes-container");

        sortedRoutes.forEach((routeName) => {
            console.log("📌 Adding Unique Route:", routeName);

            let routeId = routeName.replace(/\s+/g, "-").toLowerCase();

            // ✅ Create checkbox for each unique route
            let checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.classList.add("route-filter");
            checkbox.value = routeName;
            checkbox.id = routeId;
            checkbox.addEventListener("change", applyFilters); // 🔹 Checkbox behavior remains unchanged

            let label = document.createElement("label");
            label.htmlFor = routeId;
            label.textContent = routeName;

            routesContainer.appendChild(checkbox);
            routesContainer.appendChild(label);
            routesContainer.appendChild(document.createElement("br"));
        });

        // ✅ Save full dataset
        window.allRoutesGeoJSON = routesGeoJSON;

        // ✅ Show all routes initially
        updateMap(routesGeoJSON.features);
        updateStats(routesGeoJSON.features); // ✅ Show stats on load
    })
    .catch((error) => console.error("❌ Error loading GeoJSON:", error));


// 🔹 Load Bus Stops from GeoJSON
    fetch("./data/paragens_chapas_maputo.geojson")
        .then((response) => response.json())
        .then((busStopsGeoJSON) => {
            console.log("✅ Loaded Bus Stops:", busStopsGeoJSON);

            // Convert UTM to Lat/Lon & Extract MultiPoint
            busStopsGeoJSON.features.forEach((feature) => {
                if (feature.geometry.type === "MultiPoint") {
                    feature.geometry.type = "Point";
                    feature.geometry.coordinates = feature.geometry.coordinates[0];
                    var utmCoords = feature.geometry.coordinates;
                    var latLonCoords = proj4("EPSG:32736", "EPSG:4326", [utmCoords[0], utmCoords[1]]);
                    feature.geometry.coordinates = latLonCoords;
                }
            });

            allStopsGeoJSON = busStopsGeoJSON; // Store all stops

            // 🚀 Show all stops initially
            updateStops(Object.values(allStopsGeoJSON.features.map(f => f.properties.route_ref)).flat());
        })
        .catch((error) => console.error("❌ Error loading Bus Stops:", error));



    // 🔹 Function to update the map with filtered routes
    function updateMap(filteredRoutes) {
        console.log("📍 Updating Map with Routes:", filteredRoutes.length);
        routesLayer.clearLayers(); // Remove previous routes

        L.geoJSON(filteredRoutes, {
            style: function (feature) {
                return { color: "#FF5733", weight: 4 };
            },
            onEachFeature: function (feature, layer) {
                var properties = feature.properties || {};
                var routeName = properties.name_2 || "Unnamed Route";
                layer.bindPopup(`<b>${routeName}</b>`);
            },
        }).addTo(routesLayer);
    }

    // 🔹 Function to update stops based on selected route
    function updateStops(selectedRoutes) {
        console.log("🚏 Updating Bus Stops for:", selectedRoutes);
        stopsLayer.clearLayers(); // Remove previous stops
    
        if (!allStopsGeoJSON) return; // Ensure stops data is loaded
    
        var filteredStops = allStopsGeoJSON.features.filter(stop => {
            return stop.properties.name_2_2 && selectedRoutes.some(route => stop.properties.name_2_2.includes(route));
        });
    
        console.log("🚏 Filtered Stops:", filteredStops.length); // Debugging
    
        L.geoJSON(filteredStops, {
            pointToLayer: function (feature, latlng) {
                console.log("📍 Adding Stop:", feature.properties.name, latlng);
                return L.circleMarker(latlng, {
                    radius: 3,
                    fillColor: "#0088FF",
                    color: "#0055AA",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: function (feature, layer) {
                let stopName = feature.properties.name ? feature.properties.name : "Paragem sem nome";
          
                // 🔹 Add a tooltip (always visible)
                layer.bindTooltip(stopName, {
                    permanent: false,  // ✅ Always show label
                    direction: "top", // Position above the marker
                    offset: [0, -8],  // Adjust position
                    className: "bus-stop-label"
                });

                

                // 🔹 Add a popup on click (optional)
                layer.bindPopup(`<b>Paragem:</b> ${stopName}<br>
                                <b>Distrito:</b> ${feature.properties.addr_distr || "N/A"}<br>
                                <b>Rua:</b> ${feature.properties.addr_stree || "N/A"}`);
                }
        }).addTo(stopsLayer);
    }

    // 🔹 Update Route Statistics in Right Sidebar
    function updateStats(selectedRoutes) {
        console.log("📊 Updating Stats for:", selectedRoutes);
    
        // Count unique routes
        let uniqueRoutesSet = new Set(window.allRoutesGeoJSON.features.map(route => route.properties.name_2));
        let totalRoutes = uniqueRoutesSet.size;

        let selectedOperators = new Set();

        let inboundDistance = 0, outboundDistance = 0;
        let inboundStops = 0, outboundStops = 0;
        let inboundOperators = new Set(), outboundOperators = new Set();
    
        // 🔹 If no routes are explicitly selected, assume all routes are selected
        if (selectedRoutes.length === 0) {
            selectedRoutes = window.allRoutesGeoJSON.features.map(route => route.properties.name_2);
        }
    
        if (selectedRoutes.length === 0) {
            selectedRoutes = window.allRoutesGeoJSON.features.map(route => route.properties.name_2);
        }
    
        selectedRoutes.forEach(routeName => {
            let route = window.allRoutesGeoJSON.features.find(r => r.properties.name_2 === routeName);
            if (!route) return;

            console.log("🔍 Checking Route:", route.properties.name_2, "Direction:", route.properties.direction);
    
            let direction = route.properties.direction; // 1 = Inbound, 2 = Outbound
            let distance = route.properties.dist_km;
    
            let numStops = allStopsGeoJSON.features.filter(stop =>
                stop.properties.name_2_2 && stop.properties.name_2_2.includes(routeName)||
                (stop.properties.route_ref && stop.properties.route_ref.includes(routeName))
            ).length;

                        
                // 🔹 Check for both directions separately
                if (String(direction) == "1") {
                    inboundDistance += distance;
                    inboundStops += numStops;
                    if (route.properties.network) inboundOperators.add(route.properties.network);
                }
                if (String(direction) == "2") {
                    outboundDistance += distance;
                    outboundStops += numStops;
                    if (route.properties.network) outboundOperators.add(route.properties.network);
                }
        }); 
  

        let inboundTime = (inboundDistance / 20 * 60).toFixed(0);
        let outboundTime = (outboundDistance / 20 * 60).toFixed(0);
    
     // 🔹 Update Sidebar Stats
        document.getElementById("total-routes").innerText = totalRoutes;
        
        // 🔹 Ensure unique selected routes by filtering out duplicates
        // 🔹 Count unique selected routes
        let uniqueSelectedRoutes = new Set();

        // If no routes are selected, use totalRoutes by default
        if (selectedRoutes.length === 0) {
            document.getElementById("selected-routes-count").innerText = totalRoutes;
        } else {
            selectedRoutes.forEach(routeName => {
                let route = window.allRoutesGeoJSON.features.find(r => r.properties.name_2 === routeName);
                if (route) {
                    uniqueSelectedRoutes.add(route.properties.name_2);
                }
            });

            // 🔹 Update with the correct count of unique selected routes
            document.getElementById("selected-routes-count").innerText = uniqueSelectedRoutes.size;
        }



        document.getElementById("selected-route").innerText = selectedRoutes.length > 1 ? "Varias rotas" : selectedRoutes[0];

        document.getElementById("inbound-distance").innerText = inboundDistance.toFixed(2);
        document.getElementById("outbound-distance").innerText = outboundDistance.toFixed(2);

        document.getElementById("inbound-stops").innerText = inboundStops;
        document.getElementById("outbound-stops").innerText = outboundStops;

        document.getElementById("inbound-travel-time").innerText = inboundTime;
        document.getElementById("outbound-travel-time").innerText = outboundTime;

        document.getElementById("route-operator").innerText = inboundOperators.size > 1 || outboundOperators.size > 1 
            ? "Varios operadores" 
            : [...inboundOperators, ...outboundOperators].join(", ");
    }
    
    



      

    // 🔹 Auto-Filter on Change (Routes & Stops)
    function applyFilters() {
        var selectedRoutes = [...document.querySelectorAll(".route-filter:checked")].map(cb => cb.value);
        console.log("🔍 Selected Routes:", selectedRoutes);
    
        if (selectedRoutes.length === 0) {
            updateMap(window.allRoutesGeoJSON.features); // Show all routes if nothing is selected
            updateStops([]);
            updateStats([]);  // 🔹 Reset to all routes when nothing selected
            return;
        }
    
        var filteredRoutes = window.allRoutesGeoJSON.features.filter(route => 
            selectedRoutes.includes(route.properties.name_2)
        );
    
        updateMap(filteredRoutes);
        updateStops(selectedRoutes);
        updateStats(selectedRoutes); // 🔹 Ensure stats update
    }
    
});

