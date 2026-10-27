// ============================================================
// VISTA CSR (CLIENT-SIDE RENDERING) - static/js/csr.js
// Consume asíncronamente la API REST (/api/datos) y construye
// el DOM directamente en el navegador del cliente.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    cargarDatosCSR();
});

window.cargarDatosCSR = async function () {
    const tituloEl = document.getElementById("titulo");
    const descEl = document.getElementById("descripcion");
    const resultadoEl = document.getElementById("resultado");
    const listaCSR = document.getElementById("csr-lista-registros");

    if (resultadoEl) {
        resultadoEl.innerHTML = `<p class="loading-pulse"><i class="fa-solid fa-satellite fa-spin"></i> Consultando API /api/datos desde el cliente (CSR)...</p>`;
    }

    try {
        const respuesta = await fetch("/api/datos");
        const datos = await respuesta.json();

        if (tituloEl) tituloEl.textContent = datos.titulo || "Análisis Satelital con IA (Vista CSR)";
        if (descEl) descEl.textContent = datos.descripcion || "Renderizado dinámico en el navegador mediante Fetch API.";

        const r = datos.resumen || {
            vegetacion: "65%",
            agua: "15%",
            zona_urbana: "10%",
            suelo_seco: "10%"
        };

        if (resultadoEl) {
            resultadoEl.innerHTML = `
                <div class="metrics-grid">
                    <div class="metric-box veg-box">
                        <span class="metric-label">🌿 Vegetación</span>
                        <strong class="metric-value">${r.vegetacion}</strong>
                    </div>
                    <div class="metric-box water-box">
                        <span class="metric-label">💧 Agua</span>
                        <strong class="metric-value">${r.agua}</strong>
                    </div>
                    <div class="metric-box urban-box">
                        <span class="metric-label">🏙️ Zona Urbana</span>
                        <strong class="metric-value">${r.zona_urbana}</strong>
                    </div>
                    <div class="metric-box dry-box">
                        <span class="metric-label">🏜️ Suelo Seco</span>
                        <strong class="metric-value">${r.suelo_seco}</strong>
                    </div>
                </div>
                <p class="csr-timestamp">
                    <i class="fa-solid fa-clock"></i> Actualizado dinámicamente vía CSR: <strong>${datos.timestamp || "Ahora"}</strong>
                    (${datos.status === "offline" ? "Servido desde Caché Offline" : "Servidor en vivo"})
                </p>
            `;
        }

        if (listaCSR && Array.isArray(datos.registros)) {
            listaCSR.innerHTML = datos.registros
                .map(
                    item => `
                <div class="csr-record-item">
                    <div class="csr-record-head">
                        <strong>#${item.id} - ${item.zona}</strong>
                        <span class="badge badge-ok">${item.origen || "Satélite"}</span>
                    </div>
                    <p class="csr-record-sub">${item.coordenadas} | Fecha: ${item.fecha}</p>
                    <p class="csr-record-desc">${item.conclusion}</p>
                    <div class="csr-record-pills">
                        <span class="pill-metric veg">Veg: ${item.vegetacion}</span>
                        <span class="pill-metric water">Agua: ${item.agua}</span>
                        <span class="pill-metric urban">Urbana: ${item.zona_urbana}</span>
                        <span class="pill-metric dry">Seco: ${item.suelo_seco}</span>
                    </div>
                </div>
            `
                )
                .join("");
        }
    } catch (error) {
        if (tituloEl) tituloEl.textContent = "Análisis Satelital con IA (Modo Offline CSR)";
        if (resultadoEl) {
            resultadoEl.innerHTML = `
                <p>Vegetación: <strong>65%</strong></p>
                <p>Agua: <strong>15%</strong></p>
                <p>Zona urbana: <strong>10%</strong></p>
                <p>Suelo seco: <strong>10%</strong></p>
            `;
        }
    }
};