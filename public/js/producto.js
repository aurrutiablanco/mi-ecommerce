let productoActual = null;
let cantidadSeleccionada = 1;

document.addEventListener('DOMContentLoaded', () => {
    obtenerDetalleProducto();
});

async function obtenerDetalleProducto() {
    const params = new URLSearchParams(window.location.search);
    const idProducto = params.get('id');
    const container = document.getElementById('pdp-container');

    if (!idProducto) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 0;">
                <h2>Producto no especificado</h2>
                <p style="color: #64748b; margin-top: 0.5rem;">No se ha proporcionado un identificador válido.</p>
                <a href="index.html" style="display: inline-block; margin-top: 1.5rem; color: #2563eb; text-decoration: none; font-weight: 600;">&larr; Volver al catálogo</a>
            </div>
        `;
        return;
    }

    try {
        // Corregido: /api/productos/ en plural
        const res = await fetch(`/api/productos/${idProducto}`);
        const data = await res.json();

        if (!data.exito || !data.producto) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 0;">
                    <h2>Producto no encontrado</h2>
                    <p style="color: #64748b; margin-top: 0.5rem;">El producto que buscas no existe o ya no está disponible.</p>
                    <a href="index.html" style="display: inline-block; margin-top: 1.5rem; color: #2563eb; text-decoration: none; font-weight: 600;">&larr; Volver al catálogo</a>
                </div>
            `;
            return;
        }

        productoActual = data.producto;
        renderizarPDP(productoActual);

    } catch (err) {
        console.error('Error al obtener el producto:', err);
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 0;">
                <h2>Error de conexión</h2>
                <p style="color: #64748b; margin-top: 0.5rem;">Ocurrió un error al cargar los datos del producto.</p>
            </div>
        `;
    }
}

function renderizarPDP(p) {
    const container = document.getElementById('pdp-container');
    const imgUrl = p.imagen_url || 'https://via.placeholder.com/500x500?text=Sin+Imagen';
    const precioFormatted = Number(p.precio).toFixed(2);
    
    // Cambiar el título de la pestaña del navegador
    document.title = `${p.nombre} - Mi Tienda`;

    container.innerHTML = `
        <!-- Columna Izquierda: Imagen -->
        <div class="pdp-image-container">
            <img src="${imgUrl}" alt="${p.nombre}">
        </div>

        <!-- Columna Derecha: Información -->
        <div class="pdp-info">
            <div class="pdp-categoria">${p.categoria || 'General'}</div>
            <h1 class="pdp-titulo">${p.nombre}</h1>
            <div class="pdp-precio">$${precioFormatted}</div>
            
            <div class="pdp-descripcion-title">Descripción del Producto</div>
            <p class="pdp-descripcion">${p.descripcion || 'Sin descripción disponible.'}</p>

            <div class="pdp-controls">
                <div class="quantity-selector">
                    <label>Cantidad:</label>
                    <div class="quantity-btn-group">
                        <button class="quantity-btn" onclick="cambiarCantidad(-1)">-</button>
                        <input type="number" id="pdp-cantidad-input" class="quantity-input" value="1" min="1" readonly>
                        <button class="quantity-btn" onclick="cambiarCantidad(1)">+</button>
                    </div>
                </div>

                <div class="pdp-actions">
                    <button class="btn-add-cart" onclick="agregarPDPAlCarrito()">
                        Agregar al Carrito
                    </button>
                    <button class="btn-buy-now" onclick="comprarPDPAhora()">
                        Comprar Ahora
                    </button>
                </div>
            </div>
        </div>
    `;
}

function cambiarCantidad(delta) {
    const input = document.getElementById('pdp-cantidad-input');
    if (!input) return;

    let nuevaCantidad = cantidadSeleccionada + delta;
    if (nuevaCantidad < 1) nuevaCantidad = 1;

    cantidadSeleccionada = nuevaCantidad;
    input.value = cantidadSeleccionada;
}

function agregarPDPAlCarrito() {
    if (!productoActual) return;
    const imgUrl = productoActual.imagen_url || 'https://via.placeholder.com/300x300?text=Sin+Imagen';
    
    // Llama a la función global definida en main.js
    agregarAlCarrito(
        productoActual.id_producto,
        productoActual.nombre,
        productoActual.precio,
        imgUrl,
        cantidadSeleccionada
    );
}

function comprarPDPAhora() {
    if (!productoActual) return;
    agregarPDPAlCarrito();
    abrirModalCheckout();
}