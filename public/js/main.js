// Estado global
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
let usuarioActual = JSON.parse(localStorage.getItem('usuario')) || null;

// Al cargar la página principal
document.addEventListener('DOMContentLoaded', () => {
    verificarSesionHeader();
    cargarCategorias();
    cargarProductos();
    renderizarCarrito();
});

// --- MANEJO DE SESIÓN EN HEADER ---

function verificarSesionHeader() {
    const userNav = document.getElementById('user-nav-container');
    if (!userNav) return;

    if (usuarioActual && usuarioActual.nombre) {
        const primerNombre = usuarioActual.nombre.split(' ')[0];
        userNav.innerHTML = `
            <span style="color: #ffffff; font-weight: 600; font-size: 0.9rem;">Hola, ${primerNombre}</span>
            <button onclick="cerrarSesion()" style="background: transparent; border: 1px solid #475569; color: #cbd5e1; padding: 5px 12px; border-radius: 15px; cursor: pointer; font-size: 0.8rem; transition: background 0.2s;">Cerrar Sesión</button>
        `;
    } else {
        userNav.innerHTML = `
            <a href="login.html" style="color: #ffffff; text-decoration: none; font-weight: 600; font-size: 0.88rem; background: rgba(255,255,255,0.1); padding: 6px 14px; border-radius: 15px; transition: background 0.2s;">Iniciar Sesión</a>
        `;
    }
}

function cerrarSesion() {
    localStorage.removeItem('usuario');
    usuarioActual = null;
    window.location.reload();
}


// --- FUNCIONES DEL PANEL LATERAL Y MODALES ---

function abrirCarrito() {
    document.getElementById('cart-drawer').classList.add('abierto');
    document.getElementById('overlay').classList.add('activo');
}

function cerrarCarrito() {
    document.getElementById('cart-drawer').classList.remove('abierto');
    document.getElementById('overlay').classList.remove('activo');
}

function abrirModalCheckout() {
    if (carrito.length === 0) {
        alert('Tu carrito está vacío. Agrega al menos un producto.');
        return;
    }

    // Interceptar si el usuario NO ha iniciado sesión
    usuarioActual = JSON.parse(localStorage.getItem('usuario'));
    if (!usuarioActual) {
        alert('Debes iniciar sesión o registrarte para realizar tu compra.');
        window.location.href = 'login.html';
        return;
    }

    // Precompletar formulario con datos del usuario autenticado
    const inputNombre = document.getElementById('cliente-nombre');
    const inputCorreo = document.getElementById('cliente-correo');
    const inputTel = document.getElementById('cliente-telefono');

    if (inputNombre) inputNombre.value = usuarioActual.nombre || '';
    if (inputCorreo) inputCorreo.value = usuarioActual.correo || '';
    if (inputTel) inputTel.value = usuarioActual.telefono || '';

    cerrarCarrito();
    document.getElementById('checkout-modal').classList.add('activo');
    document.getElementById('overlay').classList.add('activo');
}

function cerrarModal() {
    document.getElementById('checkout-modal').classList.remove('activo');
    document.getElementById('overlay').classList.remove('activo');
}


// --- LÓGICA DE CATEGORÍAS Y PRODUCTOS ---

async function cargarCategorias() {
    try {
        const res = await fetch('/api/categorias');
        const data = await res.json();

        if (data.exito && data.categorias.length > 0) {
            const bar = document.getElementById('categorias-bar');
            if (!bar) return;

            let html = `<button class="cat-btn activo" onclick="filtrarCategoria('todas', this)">Todas</button>`;

            data.categorias.forEach(cat => {
                html += `<button class="cat-btn" onclick="filtrarCategoria('${cat}', this)">${cat}</button>`;
            });

            bar.innerHTML = html;
        }
    } catch (err) {
        console.error('Error cargando categorías:', err);
    }
}

async function filtrarCategoria(categoria, boton) {
    const botones = document.querySelectorAll('.cat-btn');
    botones.forEach(b => b.classList.remove('activo'));
    if (boton) {
        boton.classList.add('activo');
    }

    cargarProductos(categoria);
}

async function cargarProductos(categoria = 'todas') {
    const container = document.getElementById('productos-container');
    if (!container) return;

    container.innerHTML = '<p>Cargando productos...</p>';

    try {
        let url = '/api/productos';
        if (categoria !== 'todas') {
            url += `?categoria=${encodeURIComponent(categoria)}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (!data.exito || data.productos.length === 0) {
            container.innerHTML = '<p>No hay productos disponibles en esta categoría.</p>';
            return;
        }

        let html = '';
        data.productos.forEach(p => {
            const imgUrl = p.imagen_url || 'https://via.placeholder.com/300x300?text=Sin+Imagen';
            const precioFormatted = Number(p.precio).toFixed(2);

            html += `
                <div class="card-producto">
                    <div class="card-img-container" onclick="window.location.href='producto.html?id=${p.id_producto}'">
                        <img src="${imgUrl}" alt="${p.nombre}">
                    </div>
                    <div class="card-body">
                        <div class="card-categoria">${p.categoria || 'General'}</div>
                        <a href="producto.html?id=${p.id_producto}" class="card-titulo">${p.nombre}</a>
                        <div class="card-precio">$${precioFormatted}</div>
                        <div class="card-actions">
                            <a href="producto.html?id=${p.id_producto}" class="btn-ver">Ver</a>
                            <button class="btn-agregar" onclick="agregarAlCarrito(${p.id_producto}, '${p.nombre.replace(/'/g, "\\'")}', ${p.precio}, '${imgUrl}')">
                                Agregar
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = '<p>Error al conectar con la base de datos.</p>';
        console.error('Error cargando productos:', err);
    }
}


// --- LÓGICA DEL CARRITO EN LOCALSTORAGE ---

function agregarAlCarrito(id, nombre, precio, imagen_url, cantidad = 1) {
    const index = carrito.findIndex(item => item.id_producto === id);

    if (index !== -1) {
        carrito[index].cantidad += cantidad;
    } else {
        carrito.push({
            id_producto: id,
            nombre: nombre,
            precio: precio,
            imagen_url: imagen_url,
            cantidad: cantidad
        });
    }

    guardarYActualizarCarrito();
    abrirCarrito();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    guardarYActualizarCarrito();
}

function guardarYActualizarCarrito() {
    localStorage.setItem('carrito', JSON.stringify(carrito));
    renderizarCarrito();
}

function renderizarCarrito() {
    const container = document.getElementById('cart-items-container');
    const badgeCount = document.getElementById('cart-count');
    const totalPriceEl = document.getElementById('cart-total-price');

    if (!container) return;

    let totalItems = 0;
    let totalMonto = 0;

    if (carrito.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; margin-top:2rem;">Tu carrito está vacío.</p>';
    } else {
        let html = '';
        carrito.forEach((item, index) => {
            totalItems += item.cantidad;
            totalMonto += item.precio * item.cantidad;

            html += `
                <div class="cart-item">
                    <img src="${item.imagen_url}" alt="${item.nombre}">
                    <div class="cart-item-info">
                        <h4>${item.nombre}</h4>
                        <p>${item.cantidad} x $${Number(item.precio).toFixed(2)} = <strong>$${(item.cantidad * item.precio).toFixed(2)}</strong></p>
                    </div>
                    <button class="btn-eliminar" onclick="eliminarDelCarrito(${index})">&times;</button>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    if (badgeCount) badgeCount.textContent = totalItems;
    if (totalPriceEl) totalPriceEl.textContent = `$${totalMonto.toFixed(2)}`;
}


// --- ENVÍO DEL PEDIDO A LA API ---

async function procesarPedido(event) {
    event.preventDefault();

    usuarioActual = JSON.parse(localStorage.getItem('usuario'));
    if (!usuarioActual || !usuarioActual.id_usuario) {
        alert('Debes iniciar sesión para procesar tu compra.');
        window.location.href = 'login.html';
        return;
    }

    const payload = {
        id_usuario: usuarioActual.id_usuario,
        items: carrito
    };

    try {
        const btnSubmit = event.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Procesando...';

        const res = await fetch('/api/crear-pedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.exito) {
            alert(`¡Pedido #${data.id_pedido} realizado con éxito!\nRevisa tu correo (${usuarioActual.correo}) para ver tu factura en PDF.`);
            carrito = [];
            guardarYActualizarCarrito();
            cerrarModal();
            document.getElementById('checkout-form').reset();
        } else {
            alert('Error al procesar el pedido: ' + (data.mensaje || data.error));
        }

        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Confirmar y Pagado';
    } catch (err) {
        alert('Error de conexión con el servidor.');
        console.error(err);
    }
}