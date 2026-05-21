// Credenciales por defecto
const CREDENCIALES_DEFAULT = {
    usuario: 'admin',
    contraseña: 'admin123'
};

// Variables globales
let sesionActiva = false;
let productosActuales = [];
let ordenesActuales = [];
let productoEnEdicion = null;
const API_URL = 'https://3ulergkxc7.execute-api.us-east-1.amazonaws.com/default/api/v1';

// ==================== AUTENTICACIÓN ====================
function iniciarSesion(event) {
    event.preventDefault();
    console.log('Iniciando sesión...');
    
    const usuarioInput = document.getElementById('usuario');
    const contraseñaInput = document.getElementById('contraseña');
    
    if (!usuarioInput || !contraseñaInput) {
        alert('❌ Error: Elementos del formulario no encontrados');
        return false;
    }
    
    const usuario = usuarioInput.value.trim();
    const contraseña = contraseñaInput.value;
    
    console.log('Usuario ingresado:', usuario);
    console.log('Credenciales esperadas:', CREDENCIALES_DEFAULT.usuario);
    
    if (usuario === CREDENCIALES_DEFAULT.usuario && 
        contraseña === CREDENCIALES_DEFAULT.contraseña) {
        console.log('✓ Credenciales correctas');
        sesionActiva = true;
        localStorage.setItem('sessionAdmin', JSON.stringify({ usuario, timestamp: Date.now() }));
        
        const loginContainer = document.getElementById('login-container');
        const adminContainer = document.getElementById('admin-container');
        
        if (loginContainer) {
            loginContainer.style.display = 'none';
            console.log('✓ Login ocultado');
        }
        if (adminContainer) {
            adminContainer.style.display = 'block';
            console.log('✓ Admin mostrado');
        }
        
        console.log('Cargando datos...');
        setTimeout(() => {
            cargarDatos();
            mostrarSeccion('dashboard');
        }, 100);
        
        console.log('✓ Sesión iniciada exitosamente');
    } else {
        console.log('✗ Credenciales incorrectas');
        alert('❌ Usuario o contraseña incorrectos\n\nUsuario: admin\nContraseña: admin123');
    }
    
    return false;
}

function cerrarSesion() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        sesionActiva = false;
        localStorage.removeItem('sessionAdmin');
        
        console.log('Mostrando login...');
        const adminContainer = document.getElementById('admin-container');
        const loginContainer = document.getElementById('login-container');
        
        if (adminContainer) adminContainer.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'flex';
        
        // Limpiar formulario
        const usuarioInput = document.getElementById('usuario');
        const contraseñaInput = document.getElementById('contraseña');
        if (usuarioInput) usuarioInput.value = '';
        if (contraseñaInput) contraseñaInput.value = '';
        
        console.log('✓ Sesión cerrada');
    }
}

// ==================== NAVEGACIÓN ====================
function mostrarSeccion(seccion) {
    console.log('Mostrando sección:', seccion);
    
    try {
        // Ocultar todas las secciones
        document.querySelectorAll('.admin-section').forEach(s => {
            s.classList.remove('active');
        });
        
        // Desactivar todos los botones de nav
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Mostrar sección actual
        const seccionElement = document.getElementById(seccion);
        if (seccionElement) {
            seccionElement.classList.add('active');
            console.log('✓ Sección mostrada:', seccion);
        } else {
            console.warn('⚠️ Sección no encontrada:', seccion);
            return;
        }
        
        // Activar el botón correcto
        document.querySelectorAll('.nav-btn').forEach(btn => {
            const texto = btn.textContent.toLowerCase();
            if ((seccion === 'dashboard' && texto.includes('dashboard')) ||
                (seccion === 'productos' && texto.includes('productos')) ||
                (seccion === 'ordenes' && texto.includes('órdenes'))) {
                btn.classList.add('active');
            }
        });
        
        // Recargar datos según la sección
        if (seccion === 'productos') {
            cargarProductos();
        } else if (seccion === 'ordenes') {
            cargarOrdenes();
        } else if (seccion === 'dashboard') {
            actualizarDashboard();
        }
    } catch (error) {
        console.error('Error en mostrarSeccion:', error);
    }
}

// ==================== CARGA DE DATOS ====================
async function cargarDatos() {
    try {
        await cargarProductos();
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
    
    try {
        await cargarOrdenes();
    } catch (error) {
        console.error('Error al cargar órdenes:', error);
    }
    
    actualizarDashboard();
}

async function cargarProductos() {
    try {
        const respuesta = await fetch(`${API_URL}/products`);
        if (!respuesta.ok) {
            console.warn('API no disponible, usando datos vacíos');
            productosActuales = [];
            mostrarListaProductos();
            return;
        }
        
        productosActuales = await respuesta.json();
        mostrarListaProductos();
    } catch (error) {
        console.error('Error:', error);
        productosActuales = [];
        document.getElementById('lista-productos').innerHTML = 
            '<p class="sin-productos">⚠️ No se pudo conectar a la API. Asegúrate de que el servidor esté corriendo en http://localhost:5253</p>';
    }
}

async function cargarOrdenes() {
    try {
        const respuesta = await fetch(`${API_URL}/orders`);
        if (!respuesta.ok) throw new Error('Error al obtener órdenes de DynamoDB');
        
        ordenesActuales = await respuesta.json();
        
        // Ordenar de más recientes a más antiguas (opcional)
        ordenesActuales.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        mostrarListaOrdenes();
    } catch (error) {
        console.error('Error:', error);
        ordenesActuales = [];
        document.getElementById('lista-ordenes').innerHTML = 
            '<p class="sin-ordenes">⚠️ No se pudo conectar a la base de datos de órdenes.</p>';
    }
}

function actualizarDashboard() {
    const totalProductos = productosActuales.length;
    const totalOrdenes = ordenesActuales.length;
    const totalIngresos = ordenesActuales.reduce((sum, orden) => sum + orden.total, 0);
    const stockBajo = productosActuales.filter(p => p.stock < 5).length;
    
    document.getElementById('total-productos').textContent = totalProductos;
    document.getElementById('total-ordenes').textContent = totalOrdenes;
    document.getElementById('total-ingresos').textContent = `$${totalIngresos.toFixed(2)}`;
    document.getElementById('stock-bajo').textContent = stockBajo;
}

// ==================== GESTIÓN DE PRODUCTOS ====================
function mostrarFormularioProducto() {
    productoEnEdicion = null;
    document.getElementById('formulario-titulo').textContent = 'Agregar Nuevo Producto';
    document.getElementById('formulario-producto').classList.remove('hidden');
    document.getElementById('prod-titulo').focus();
    
    // Limpiar campos
    document.querySelector('#formulario-producto form').reset();
}

function cancelarFormulario() {
    productoEnEdicion = null;
    document.getElementById('formulario-producto').classList.add('hidden');
}

async function guardarProducto(event) {
    event.preventDefault();
    
    const nuevoProducto = {
        title: document.getElementById('prod-titulo').value,
        type: document.getElementById('prod-type').value,
        category: document.getElementById('prod-category').value,
        price: parseFloat(document.getElementById('prod-precio').value),
        stock: parseInt(document.getElementById('prod-stock').value)
    };
    
    console.log('Enviando producto:', nuevoProducto);
    
    try {
        let url = `${API_URL}/products`;
        let metodo = 'POST';
        
        if (productoEnEdicion) {
            url = `${API_URL}/products/${productoEnEdicion.id}`;
            metodo = 'PUT';
        }
        
        console.log(`${metodo} a:`, url);
        
        const respuesta = await fetch(url, {
            method: metodo,
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(nuevoProducto)
        });
        
        console.log('Respuesta status:', respuesta.status);
        const textoRespuesta = await respuesta.text();
        console.log('Respuesta body:', textoRespuesta);
        
        if (!respuesta.ok) {
            throw new Error(`Error ${respuesta.status}: ${textoRespuesta}`);
        }
        
        if (productoEnEdicion) {
            alert('✅ Producto actualizado exitosamente');
        } else {
            alert('✅ Producto creado exitosamente');
        }
        
        cancelarFormulario();
        await cargarProductos();
        actualizarDashboard();
    } catch (error) {
        console.error('Error al guardar:', error);
        alert('❌ Error: ' + error.message);
    }
}

async function editarProducto(producto) {
    productoEnEdicion = producto;
    
    document.getElementById('formulario-titulo').textContent = 'Editar Producto';
    document.getElementById('prod-titulo').value = producto.title;
    document.getElementById('prod-type').value = producto.type;
    document.getElementById('prod-category').value = producto.category;
    document.getElementById('prod-precio').value = producto.price;
    document.getElementById('prod-stock').value = producto.stock;
    
    document.getElementById('formulario-producto').classList.remove('hidden');
}

async function eliminarProducto(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) return;
    
    try {
        const respuesta = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE'
        });
        
        if (!respuesta.ok) throw new Error('Error al eliminar');
        
        alert('✅ Producto eliminado exitosamente');
        await cargarProductos();
        actualizarDashboard();
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

function mostrarListaProductos() {
    const container = document.getElementById('lista-productos');
    
    if (productosActuales.length === 0) {
        container.innerHTML = '<p class="sin-productos">No hay productos. ¡Crea uno para comenzar!</p>';
        return;
    }
    
    container.innerHTML = productosActuales.map(producto => {
        let stockClass = 'stock-ok';
        let stockTexto = `${producto.stock} disponibles`;
        
        if (producto.stock === 0) {
            stockClass = 'stock-agotado';
            stockTexto = 'Agotado';
        } else if (producto.stock < 5) {
            stockClass = 'stock-bajo';
            stockTexto = `${producto.stock} - ⚠️ Stock bajo`;
        }
        
        // Mostrar placeholder si no hay imagen
        const imagenUrl = producto.imageUrl || 'https://via.placeholder.com/300?text=Sin+Imagen';
        
        return `
            <div class="producto-admin">
                <img src="${imagenUrl}" alt="${producto.title}" class="producto-admin-imagen" 
                     onerror="this.src='https://via.placeholder.com/300?text=Sin+Imagen'">
                <div class="producto-admin-info">
                    <h4>${producto.title}</h4>
                    <p><strong>Tipo:</strong> ${producto.type}</p>
                    <p><strong>Categoría:</strong> ${producto.category}</p>
                    <div class="producto-admin-precio">$${producto.price.toFixed(2)}</div>
                    <div class="producto-admin-stock ${stockClass}">${stockTexto}</div>
                    <div class="producto-admin-acciones">
                        <button class="btn-editar" onclick='editarProducto(${JSON.stringify(producto).replace(/'/g, "&apos;")})'>✏️ Editar</button>
                        <button class="btn-eliminar" onclick="eliminarProducto(${producto.id})">🗑️ Eliminar</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== GESTIÓN DE ÓRDENES ====================
function mostrarListaOrdenes() {
    const container = document.getElementById('lista-ordenes');
    
    if (ordenesActuales.length === 0) {
        container.innerHTML = '<p class="sin-ordenes">No hay órdenes recibidas aún</p>';
        return;
    }
    
    container.innerHTML = ordenesActuales.map((orden, index) => {
        const fechaCompletada = orden.fechaCompletada ? new Date(orden.fechaCompletada).toLocaleDateString() : null;
        const botonCompletarDisabled = orden.completada ? 'disabled' : '';
        const textoBoton = orden.completada ? '✓ Completada' : '✓ Marcar Completada';
        
        return `
            <div class="orden-card">
                <div class="orden-header">
                    <div class="orden-id">Orden #${orden.id}</div>
                    <span class="orden-estado ${orden.completada ? 'estado-completada' : 'estado-pendiente'}">
                        ${orden.completada ? 'COMPLETADA' : 'PENDIENTE'}
                    </span>
                </div>
                
                <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #333;">
                    <p><strong>Cliente:</strong> ${orden.cliente}</p>
                    <p><strong>Email:</strong> ${orden.email}</p>
                    <p><strong>Teléfono:</strong> ${orden.telefono}</p>
                    <p><strong>Fecha de Orden:</strong> ${new Date(orden.fecha).toLocaleDateString()}</p>
                    ${fechaCompletada ? `<p><strong>Fecha Completada:</strong> ${fechaCompletada}</p>` : ''}
                </div>
                
                <div class="orden-productos">
                    <strong style="color: #f4a230;">Productos:</strong>
                    ${orden.productos.map(prod => {
                        const productoEnBD = productosActuales.find(p => p.id === prod.id);
                        const stockDisponible = productoEnBD ? productoEnBD.stock : 'N/A';
                        const stockColor = stockDisponible === 0 ? '#f44336' : '#999999';
                        const stockTexto = stockDisponible === 0 ? 'Producto no disponible por el momento' : `Stock en BD: ${stockDisponible}`;
                        return `
                            <div class="orden-producto-item">
                                <div class="orden-producto-nombre">
                                    ${prod.title}<br>
                                    <small style="color: ${stockColor}; font-weight: 600;">${stockTexto}</small>
                                </div>
                                <div class="orden-producto-cantidad">x${prod.cantidad}</div>
                                <div class="orden-producto-precio">$${(prod.precio * prod.cantidad).toFixed(2)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
                    <div style="text-align: left; font-size: 1.2em; font-weight: 700; color: #4caf50;">
                        Total: $${orden.total.toFixed(2)}
                    </div>
                    ${!orden.completada ? `<button class="btn-completar-orden" onclick="completarOrden('${orden.id}')">✓ Marcar Completada</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ==================== COMPLETAR ORDEN ====================
function completarOrden(ordenId) {
    const ordenIndex = ordenesActuales.findIndex(o => o.id === ordenId);
    if (ordenIndex === -1) return;
    
    const orden = ordenesActuales[ordenIndex];
    
    if (confirm(`¿Marcar orden #${orden.id} como completada?\n\nEsto restará el stock de los productos.`)) {
        // Restar stock de cada producto
        orden.productos.forEach(productoOrden => {
            const productoIndex = productosActuales.findIndex(p => p.id === productoOrden.id);
            if (productoIndex !== -1) {
                productosActuales[productoIndex].stock -= productoOrden.cantidad;
                console.log(`Stock actualizado: ${productosActuales[productoIndex].title} = ${productosActuales[productoIndex].stock}`);
            }
        });
        
        // Actualizar la orden como completada
        orden.completada = true;
        orden.fechaCompletada = new Date().toISOString();
        
        // BORRAR el localStorage.setItem('ordenes', ...);
        
        // ¡NUEVO! Actualizar la orden en la nube (DynamoDB)
        fetch(`${API_URL}/orders/${orden.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orden)
        }).catch(err => console.error("Error al actualizar orden en la nube:", err));
        
        // Actualizar productos en la API (esto ya lo tenías)
        actualizarStockEnAPI();
        
        alert('✅ Orden completada y stock actualizado');
        mostrarListaOrdenes();
        actualizarDashboard();
    }
}

// Actualizar stock en la API
async function actualizarStockEnAPI() {
    try {
        for (const producto of productosActuales) {
            await fetch(`${API_URL}/products/${producto.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    id: producto.id, // <-- Agregar
                    title: producto.title,
                    type: producto.type,
                    category: producto.category,
                    price: producto.price,
                    stock: producto.stock,
                    imageUrl: producto.imageUrl // <-- ¡Súper crítico para no perder las fotos!
                })
            });
        }
        console.log('✓ Stock actualizado en la API');
    } catch (error) {
        console.error('Error al actualizar stock en API:', error);
    }
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si hay sesión activa
    const sesionGuardada = localStorage.getItem('sessionAdmin');
    if (sesionGuardada) {
        const sesion = JSON.parse(sesionGuardada);
        const tiempoTranscurrido = Date.now() - sesion.timestamp;
        // Sesión válida por 24 horas
        if (tiempoTranscurrido < 86400000) {
            sesionActiva = true;
            document.getElementById('login-container').classList.remove('active');
            document.getElementById('admin-container').classList.add('active');
            cargarDatos();
        }
    }
});
