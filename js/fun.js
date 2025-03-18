// ✅ Ensure "map" is globally available
if (typeof window.map === "undefined") {
    console.error("❌ Global map variable is not set!");
} else {
    console.log("✅ Map is loaded:", window.map);
}

// ✅ Load Routes & Populate "Divisão Administrativa" with Checkboxes
fetch("./data/rotas_chapas2.geojson")
    .then(response => response.json())
    .then(routesGeoJSON => {
        console.log("✅ Loaded Routes:", routesGeoJSON);

        let districtContainer = document.getElementById("district-container");
        if (!districtContainer) {
            console.error("❌ District container not found!");
            return;
        }

        let uniqueCities = new Set();
        routesGeoJSON.features.forEach(feature => {
            if (feature.properties && feature.properties.area) {
                uniqueCities.add(feature.properties.area);
            }
        });

        console.log("✅ Unique Cities Extracted:", [...uniqueCities]);

        districtContainer.innerHTML = "";

        uniqueCities.forEach(area => {
            let checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = area;
            checkbox.classList.add("district-filter");
            checkbox.addEventListener("change", applyDistrictFilter);

            let label = document.createElement("label");
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(" " + area));

            let div = document.createElement("div");
            div.appendChild(label);
            districtContainer.appendChild(div);
        });

        console.log("✅ Checkboxes created for:", [...uniqueCities]);

        // ✅ Store routes globally
        window.allRoutesGeoJSON = routesGeoJSON;
    })
    .catch(error => console.error("❌ Error loading routes:", error));


// ✅ Apply District Filter & Zoom Function
function applyDistrictFilter() {
    var selectedCities = [...document.querySelectorAll("#district-container input:checked")]
        .map(cb => cb.value);

    console.log("Selected Cities: ", selectedCities);

    if (selectedCities.length === 0) {
        console.warn("⚠️ No cities selected, showing all routes.");
        updateMap(window.allRoutesGeoJSON.features);
        return;
    }

    var filteredRoutes = window.allRoutesGeoJSON.features.filter(feature =>
        selectedCities.includes(feature.properties.area)
    );

    console.log("✅ Filtered Routes Count:", filteredRoutes.length);

    updateMap(filteredRoutes);
    zoomToLayer(selectedCities);

    var bounds = L.latLngBounds();
    filteredRoutes.forEach(feature => {
        feature.geometry.coordinates.forEach(line => {
            line.forEach(coord => {
                bounds.extend([coord[1], coord[0]]);
            });
        });
    });

    console.log("📌 Bounds before zoom:", bounds);

    if (typeof window.map === "undefined" || !(window.map instanceof L.Map)) {
        console.error("❌ Map is not initialized or not a Leaflet map!");
        return;
    }

    if (bounds.isValid()) {
        setTimeout(() => {
            window.map.fitBounds(bounds);
        }, 500);
    } else {
        console.error("❌ No valid bounds.");
    }
}


function zoomToLayer(layer) {
    if (layer.length) {
        let bounds = L.geoJSON(layer).getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds);
        }
    }
}
