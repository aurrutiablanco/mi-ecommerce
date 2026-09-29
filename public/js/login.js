function mostrarTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegistro = document.getElementById('tab-registro');
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');
    const alertBox = document.getElementById('alert-box');

    alertBox.style.display = 'none';

    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegistro.classList.remove('active');
        formLogin.classList.add('active');
        formRegistro.classList.remove('active');
    } else {
        tabRegistro.classList.add('active');
        tabLogin.classList.remove('active');
        formRegistro.classList.add('active');
        formLogin.classList.remove('active');
    }
}

function mostrarAlerta(mensaje, tipo) {
    const alertBox = document.getElementById('alert-box');
    alertBox.innerText = mensaje;
    alertBox.className = `alert alert-${tipo}`;
    alertBox.style.display = 'block';
}

async function procesarLogin(event) {
    event.preventDefault();
    
    const correo = document.getElementById('login-correo').value.trim();
    const contrasena = document.getElementById('login-contrasena').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, contrasena })
        });

        const data = await res.json();

        if (data.exito) {
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            mostrarAlerta('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1200);
        } else {
            mostrarAlerta(data.mensaje || 'Error al iniciar sesión', 'error');
        }
    } catch (err) {
        console.error('Error al iniciar sesión:', err);
        mostrarAlerta('Ocurrió un error de conexión con el servidor', 'error');
    }
}

async function procesarRegistro(event) {
    event.preventDefault();

    const nombre = document.getElementById('reg-nombre').value.trim();
    const correo = document.getElementById('reg-correo').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const contrasena = document.getElementById('reg-contrasena').value;

    try {
        const res = await fetch('/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, telefono, contrasena })
        });

        const data = await res.json();

        if (data.exito) {
            localStorage.setItem('usuario', JSON.stringify(data.usuario));
            mostrarAlerta('¡Cuenta creada con éxito! Redirigiendo...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1200);
        } else {
            mostrarAlerta(data.mensaje || 'Error al registrar usuario', 'error');
        }
    } catch (err) {
        console.error('Error al registrar usuario:', err);
        mostrarAlerta('Ocurrió un error de conexión con el servidor', 'error');
    }
}