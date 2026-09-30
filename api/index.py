import os
import io
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from fpdf import FPDF
import libsql_client
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Variables de Entorno
TURSO_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_TOKEN = os.getenv("TURSO_AUTH_TOKEN")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")

def get_db_client():
    return libsql_client.create_client_sync(
        url=TURSO_URL,
        auth_token=TURSO_TOKEN
    )

# --- CLASE PARA LA FACTURA PDF ---
class FacturaPDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 16)
        self.cell(0, 10, 'COMPROBANTE DE COMPRA', dest=0, align='C')
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.cell(0, 10, 'Gracias por su compra - Mi Tienda Online', align='C')

def generar_pdf_bytes(id_pedido, usuario, items, total):
    pdf = FacturaPDF()
    pdf.add_page()
    
    # Encabezado Tienda
    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 8, 'Mi Tienda Online', ln=True)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 5, f'Pedido #: {id_pedido}', ln=True)
    pdf.cell(0, 5, f'Cliente: {usuario["nombre"]}', ln=True)
    pdf.cell(0, 5, f'Correo: {usuario["correo"]}', ln=True)
    pdf.cell(0, 5, f'Telefono: {usuario["telefono"]}', ln=True)
    pdf.ln(8)
    
    # Tabla de Productos
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(90, 8, 'Producto', border=1)
    pdf.cell(30, 8, 'Precio Cant.', border=1, align='C')
    pdf.cell(30, 8, 'Cantidad', border=1, align='C')
    pdf.cell(40, 8, 'Subtotal', border=1, align='C')
    pdf.ln()
    
    pdf.set_font('Helvetica', '', 10)
    for item in items:
        subtotal = float(item['precio']) * int(item['cantidad'])
        pdf.cell(90, 8, str(item['nombre'])[:35], border=1)
        pdf.cell(30, 8, f"${float(item['precio']):.2f}", border=1, align='C')
        pdf.cell(30, 8, str(item['cantidad']), border=1, align='C')
        pdf.cell(40, 8, f"${subtotal:.2f}", border=1, align='C')
        pdf.ln()
        
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(150, 10, 'TOTAL:', border=1, align='R')
    pdf.cell(40, 10, f"${total:.2f}", border=1, align='C')
    
    # Exportar a buffer en memoria
    pdf_buffer = io.BytesIO()
    pdf_string = pdf.output(dest='S')
    if isinstance(pdf_string, str):
        pdf_buffer.write(pdf_string.encode('latin1'))
    else:
        pdf_buffer.write(pdf_string)
    pdf_buffer.seek(0)
    return pdf_buffer.getvalue()

def enviar_correos_pedido(id_pedido, usuario, items, total, pdf_bytes):
    if not SMTP_USER or not SMTP_PASS:
        print("SMTP no configurado. Saltando envío de correos.")
        return

    # 1. Enviar Factura al Cliente
    msg_cliente = MIMEMultipart()
    msg_cliente['From'] = SMTP_USER
    msg_cliente['To'] = usuario['correo']
    msg_cliente['Subject'] = f"Confirmación de Pedido #{id_pedido} - Mi Tienda"
    
    body_cliente = f"""Hola {usuario['nombre']},

¡Gracias por tu compra! Adjunto a este correo encontrarás la factura en PDF de tu pedido #{id_pedido}.

Monto Total: ${total:.2f}

Nos pondremos en contacto contigo a la brevedad para coordinar la entrega.
"""
    msg_cliente.attach(MIMEText(body_cliente, 'plain'))
    
    adjunto = MIMEApplication(pdf_bytes, _subtype="pdf")
    adjunto.add_header('Content-Disposition', 'attachment', filename=f'Factura_Pedido_{id_pedido}.pdf')
    msg_cliente.attach(adjunto)

    # 2. Enviar Notificación al Administrador
    msg_admin = MIMEMultipart()
    msg_admin['From'] = SMTP_USER
    msg_admin['To'] = ADMIN_EMAIL or SMTP_USER
    msg_admin['Subject'] = f"¡NUEVO PEDIDO RECIBIDO! - Pedido #{id_pedido}"
    
    lista_productos_txt = "\n".join([f"- {i['cantidad']}x {i['nombre']} (${float(i['precio']):.2f} c/u)" for i in items])
    
    body_admin = f"""¡Atención! Se ha generado un nuevo pedido en la tienda.

DATOS DEL CLIENTE PARA CONTACTAR:
---------------------------------
Nombre: {usuario['nombre']}
Correo: {usuario['correo']}
Teléfono: {usuario['telefono']}

DETALLE DEL PEDIDO (#{id_pedido}):
---------------------------------
{lista_productos_txt}

TOTAL A COBRAR: ${total:.2f}
"""
    msg_admin.attach(MIMEText(body_admin, 'plain'))
    
    adjunto_admin = MIMEApplication(pdf_bytes, _subtype="pdf")
    adjunto_admin.add_header('Content-Disposition', 'attachment', filename=f'Factura_Pedido_{id_pedido}.pdf')
    msg_admin.attach(adjunto_admin)

    # Conexión SMTP y envío
    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, usuario['correo'], msg_cliente.as_string())
        server.sendmail(SMTP_USER, ADMIN_EMAIL or SMTP_USER, msg_admin.as_string())
        server.quit()
        print(f"Correos enviados con éxito para el pedido #{id_pedido}")
    except Exception as e:
        print(f"Error enviando correos SMTP: {e}")

# --- RUTAS DE LA API ---

@app.route('/api/registro', methods=['POST'])
def registro():
    data = request.get_json() or {}
    nombre = data.get('nombre')
    correo = data.get('correo')
    telefono = data.get('telefono', '')
    contrasena = data.get('contrasena')

    if not nombre or not correo or not contrasena:
        return jsonify({'exito': False, 'mensaje': 'Faltan datos obligatorios'}), 400

    try:
        db = get_db_client()
        res = db.execute("SELECT id_usuario FROM usuarios WHERE correo_electronico = ?", [correo])
        if len(res.rows) > 0:
            return jsonify({'exito': False, 'mensaje': 'El correo ya está registrado'}), 400

        hash_pass = generate_password_hash(contrasena)
        db.execute(
            "INSERT INTO usuarios (nombre, telefono, correo_electronico, contrasena) VALUES (?, ?, ?, ?)",
            [nombre, telefono, correo, hash_pass]
        )
        
        res_nuevo = db.execute("SELECT id_usuario FROM usuarios WHERE correo_electronico = ?", [correo])
        id_nuevo = res_nuevo.rows[0][0] if len(res_nuevo.rows) > 0 else None

        usuario = {
            'id_usuario': id_nuevo,
            'nombre': nombre,
            'correo': correo,
            'telefono': telefono
        }
        return jsonify({'exito': True, 'usuario': usuario})
    except Exception as e:
        print("Error en registro:", e)
        return jsonify({'exito': False, 'mensaje': f'Error en base de datos: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    correo = data.get('correo')
    contrasena = data.get('contrasena')

    try:
        db = get_db_client()
        res = db.execute("SELECT id_usuario, nombre, correo_electronico, telefono, contrasena FROM usuarios WHERE correo_electronico = ?", [correo])
        if len(res.rows) == 0:
            return jsonify({'exito': False, 'mensaje': 'Credenciales inválidas'}), 401

        row = res.rows[0]
        id_usuario, nombre, correo_db, telefono, hash_pass = row[0], row[1], row[2], row[3], row[4]

        if check_password_hash(hash_pass, contrasena):
            usuario = {
                'id_usuario': id_usuario,
                'nombre': nombre,
                'correo': correo_db,
                'telefono': telefono
            }
            return jsonify({'exito': True, 'usuario': usuario})
        else:
            return jsonify({'exito': False, 'mensaje': 'Credenciales inválidas'}), 401
    except Exception as e:
        print("Error en login:", e)
        return jsonify({'exito': False, 'mensaje': str(e)}), 500

@app.route('/api/categorias', methods=['GET'])
def obtener_categorias():
    try:
        db = get_db_client()
        res = db.execute("SELECT DISTINCT categoria FROM productos WHERE categoria IS NOT NULL")
        categorias = [row[0] for row in res.rows if row[0]]
        return jsonify({'exito': True, 'categorias': categorias})
    except Exception as e:
        return jsonify({'exito': False, 'mensaje': str(e)}), 500

@app.route('/api/productos', methods=['GET'])
def obtener_productos():
    categoria = request.args.get('categoria')
    try:
        db = get_db_client()
        if categoria and categoria.lower() != 'todas':
            res = db.execute("SELECT id_producto, nombre, descripcion, precio, imagen_url, categoria FROM productos WHERE categoria = ?", [categoria])
        else:
            res = db.execute("SELECT id_producto, nombre, descripcion, precio, imagen_url, categoria FROM productos")
        
        productos = []
        for r in res.rows:
            productos.append({
                'id_producto': r[0],
                'nombre': r[1],
                'descripcion': r[2],
                'precio': r[3],
                'imagen_url': r[4],
                'categoria': r[5]
            })
        return jsonify({'exito': True, 'productos': productos})
    except Exception as e:
        return jsonify({'exito': False, 'mensaje': str(e)}), 500

@app.route('/api/productos/<int:id_producto>', methods=['GET'])
def obtener_producto_detalle(id_producto):
    try:
        db = get_db_client()
        res = db.execute("SELECT id_producto, nombre, descripcion, precio, imagen_url, categoria FROM productos WHERE id_producto = ?", [id_producto])
        if len(res.rows) == 0:
            return jsonify({'exito': False, 'mensaje': 'Producto no encontrado'}), 404
        
        r = res.rows[0]
        producto = {
            'id_producto': r[0],
            'nombre': r[1],
            'descripcion': r[2],
            'precio': r[3],
            'imagen_url': r[4],
            'categoria': r[5]
        }
        return jsonify({'exito': True, 'producto': producto})
    except Exception as e:
        return jsonify({'exito': False, 'mensaje': str(e)}), 500

@app.route('/api/crear-pedido', methods=['POST'])
def crear_pedido():
    data = request.get_json() or {}
    id_usuario = data.get('id_usuario')
    items = data.get('items', [])

    if not id_usuario or len(items) == 0:
        return jsonify({'exito': False, 'mensaje': 'Datos de pedido incompletos'}), 400

    try:
        db = get_db_client()
        res_usr = db.execute("SELECT nombre, correo_electronico, telefono FROM usuarios WHERE id_usuario = ?", [id_usuario])
        if len(res_usr.rows) == 0:
            return jsonify({'exito': False, 'mensaje': 'Usuario no existe'}), 404
        
        row_usr = res_usr.rows[0]
        usuario = {
            'id_usuario': id_usuario,
            'nombre': row_usr[0],
            'correo': row_usr[1],
            'telefono': row_usr[2]
        }

        monto_total = sum(float(item['precio']) * int(item['cantidad']) for item in items)

        db.execute(
            "INSERT INTO pedidos (id_usuario, monto_total, estado_pedido) VALUES (?, ?, ?)",
            [id_usuario, monto_total, 'Completado']
        )
        
        res_ped_id = db.execute("SELECT id_pedido FROM pedidos WHERE id_usuario = ? ORDER BY id_pedido DESC LIMIT 1", [id_usuario])
        id_pedido = res_ped_id.rows[0][0] if len(res_ped_id.rows) > 0 else None

        for item in items:
            db.execute(
                "INSERT INTO detalles_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)",
                [id_pedido, item['id_producto'], item['cantidad'], item['precio']]
            )

        pdf_bytes = generar_pdf_bytes(id_pedido, usuario, items, monto_total)
        enviar_correos_pedido(id_pedido, usuario, items, monto_total, pdf_bytes)

        return jsonify({'exito': True, 'id_pedido': id_pedido})
    except Exception as e:
        print("Error en crear_pedido:", e)
        return jsonify({'exito': False, 'mensaje': f'Error al procesar el pedido: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)