// Variable para almacenar productos agrupados
let productosAgrupados = {};
let filtroActual = null; // null = mostrar todas, o id de tipo específico
let productoActualModal = null; // Producto abierto en modal
const API_URL = 'https://3ulergkxc7.execute-api.us-east-1.amazonaws.com/default/api/v1';

// Mapeo de tipos para organizar los productos
const tiposCatalogo = [
    { id: 'poster', nombre: '📄 Posters', icon: '📄' },
    { id: 'postal', nombre: '✉️ Postales', icon: '✉️' },
    { id: 'mini-poster', nombre: '📌 Mini Posters', icon: '📌' },
    { id: 'botón', nombre: '🔘 Botones', icon: '🔘' },
    { id: 'sticker', nombre: '✨ Stickers', icon: '✨' },
    { id: 'pin', nombre: '📍 Pines', icon: '📍' }
];

// ==================== SISTEMA DE SESIÓN Y CARRITOS ====================

// 1. Función para saber de quién es el carrito (EVITA CARRITOS MEZCLADOS)
function obtenerLlaveCarrito() {
    const sessionStr = localStorage.getItem('sessionUser');
    if (sessionStr) {
        const usuario = JSON.parse(sessionStr);
        return `carrito_${usuario.usuario}`; 
    }
    return 'carrito_invitado'; 
}

// 2. Inicializamos el carrito con la llave correcta
let carrito = JSON.parse(localStorage.getItem(obtenerLlaveCarrito())) || [];


// Validar sesión al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    verificarSesion();
    actualizarContadorCarrito();
    
    // Cerrar modales con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarModal();
            cerrarCarrito();
            const modalHistorial = document.getElementById('modal-historial');
            if(modalHistorial) modalHistorial.classList.remove('active');
        }
    });
    
    // Cerrar modales al hacer clic fuera
    const modalProducto = document.getElementById('modal-producto');
    if(modalProducto) modalProducto.addEventListener('click', e => { if (e.target === modalProducto) cerrarModal(); });
    
    const modalCarrito = document.getElementById('modal-carrito');
    if(modalCarrito) modalCarrito.addEventListener('click', e => { if (e.target === modalCarrito) cerrarCarrito(); });
});

function verificarSesion() {
    const sessionStr = localStorage.getItem('sessionUser');
    const headerAcciones = document.getElementById('header-acciones');

    if (!headerAcciones) return; 

    // Al verificar sesión, recargamos el carrito por si cambió de cuenta
    carrito = JSON.parse(localStorage.getItem(obtenerLlaveCarrito())) || [];
    actualizarContadorCarrito();

    if (sessionStr) {
        const usuario = JSON.parse(sessionStr);
        
        let htmlBotones = `
            <span style="color: #f4a230; font-weight: bold; font-size: 1.2em; margin-right: 15px;">👋 Hola, ${usuario.nombre}</span>
            <button class="btn-carrito" onclick="abrirHistorial()" style="background-color: #2196F3; color: white; margin-right: 10px;">📦 Mis Pedidos</button>
            <button class="btn-carrito" onclick="abrirCarrito()">🛒 Carrito (<span id="contador-carrito">${carrito.length > 0 ? carrito.reduce((s, i) => s + i.cantidad, 0) : 0}</span>)</button>
        `;

        if (usuario.esAdmin) {
            htmlBotones += `<a href="admin.html" class="btn-admin" style="margin-left: 10px;">⚙️ Panel Admin</a>`;
        }

        htmlBotones += `<button onclick="cerrarSesionGlobal()" style="padding: 12px 25px; margin-left: 10px; background-color: #f44336; color: white; border: none; border-radius: 50px; font-weight: 600; cursor: pointer;">Cerrar Sesión</button>`;

        headerAcciones.innerHTML = htmlBotones;
    } else {
        headerAcciones.innerHTML = `
            <button class="btn-carrito" onclick="abrirCarrito()">🛒 Carrito (<span id="contador-carrito">${carrito.length > 0 ? carrito.reduce((s, i) => s + i.cantidad, 0) : 0}</span>)</button>
            <a href="admin.html" class="btn-admin" style="margin-left: 10px;">🔐 Iniciar Sesión</a>
        `;
    }
}

function cerrarSesionGlobal() {
    localStorage.removeItem('sessionUser');
    window.location.reload(); 
}

// ==================== CATÁLOGO ====================

async function obtenerProductos() {
    try {
        const contenedor = document.getElementById('contenedor-productos');
        contenedor.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando catálogo...</p></div>';

        const respuesta = await fetch(`${API_URL}/products`);
        if (!respuesta.ok) throw new Error('No se pudo conectar con la API');

        const productos = await respuesta.json();

        if (!Array.isArray(productos) || productos.length === 0) {
            contenedor.innerHTML = '<p class="sin-productos">No hay productos disponibles en el catálogo.</p>';
            return;
        }

        const productosValidados = productos.map(p => ({
            ...p,
            price: parseFloat(p.price),
            stock: parseInt(p.stock)
        }));

        productosAgrupados = agruparProductosPorTipo(productosValidados);
        crearBotonesFiltro();
        filtroActual = null;
        mostrarProductos();

    } catch (error) {
        document.getElementById('contenedor-productos').innerHTML = 
            '<div class="error-message">❌ Error al cargar el catálogo. Por favor, verifica que el servidor esté activo.</div>';
    }
}

function agruparProductosPorTipo(productos) {
    const agrupados = {};
    tiposCatalogo.forEach(tipo => { agrupados[tipo.id] = {}; });

    productos.forEach(producto => {
        const tipo = (producto.type || '').toLowerCase().trim();
        const categoria = (producto.category || 'Sin categoría').toLowerCase().trim();
        
        const tipoEncontrado = tiposCatalogo.find(t => t.id.includes(tipo) || tipo.includes(t.id));
        
        if (tipoEncontrado) {
            if (!agrupados[tipoEncontrado.id][categoria]) {
                agrupados[tipoEncontrado.id][categoria] = [];
            }
            agrupados[tipoEncontrado.id][categoria].push(producto);
        }
    });

    return agrupados;
}

function crearBotonesFiltro() {
    const contenedorBotones = document.getElementById('botones-filtro');
    contenedorBotones.innerHTML = '';

    const btnTodos = document.createElement('button');
    btnTodos.className = 'btn-filtro btn-todos active';
    btnTodos.textContent = '🎨 Todos los Productos';
    btnTodos.onclick = () => {
        filtroActual = null;
        mostrarProductos();
        actualizarBotonesFiltro();
    };
    contenedorBotones.appendChild(btnTodos);

    tiposCatalogo.forEach(tipo => {
        const totalProductos = Object.values(productosAgrupados[tipo.id] || {}).reduce((sum, arr) => sum + arr.length, 0);
        
        if (totalProductos > 0) {
            const btn = document.createElement('button');
            btn.className = 'btn-filtro';
            btn.dataset.tipo = tipo.id;
            btn.textContent = `${tipo.nombre} (${totalProductos})`;
            btn.onclick = () => {
                filtroActual = tipo.id;
                mostrarProductos();
                actualizarBotonesFiltro();
            };
            contenedorBotones.appendChild(btn);
        }
    });
}

function actualizarBotonesFiltro() {
    const botones = document.querySelectorAll('.btn-filtro');
    botones.forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains('btn-todos') && filtroActual === null) {
            btn.classList.add('active');
        } else if (btn.dataset.tipo === filtroActual) {
            btn.classList.add('active');
        }
    });
}

function mostrarProductos() {
    const contenedor = document.getElementById('contenedor-productos');
    contenedor.innerHTML = '';
    let hayProductos = false;

    if (filtroActual === null) {
        tiposCatalogo.forEach(tipo => {
            const categoriasDelTipo = productosAgrupados[tipo.id] || {};
            const totalProductos = Object.values(categoriasDelTipo).reduce((sum, arr) => sum + arr.length, 0);
            
            if (totalProductos > 0) {
                hayProductos = true;
                contenedor.appendChild(crearSeccionTipo(tipo, categoriasDelTipo, true));
            }
        });
    } else {
        const tipo = tiposCatalogo.find(t => t.id === filtroActual);
        const categoriasDelTipo = productosAgrupados[filtroActual] || {};
        const totalProductos = Object.values(categoriasDelTipo).reduce((sum, arr) => sum + arr.length, 0);
        
        if (totalProductos > 0) {
            hayProductos = true;
            contenedor.appendChild(crearSeccionTipo(tipo, categoriasDelTipo, false));
        }
    }

    if (!hayProductos) {
        contenedor.innerHTML = '<p class="sin-productos">No hay productos en esta categoría.</p>';
    }
}

function crearSeccionTipo(tipo, categorias, mostrarLimitado) {
    const seccion = document.createElement('div');
    seccion.className = 'tipo-seccion';

    const titulo = document.createElement('div');
    titulo.className = 'tipo-titulo';
    titulo.textContent = tipo.nombre;
    seccion.appendChild(titulo);

    Object.entries(categorias).forEach(([nombreCategoria, productos]) => {
        if (productos.length > 0) {
            const productosAMostrar = mostrarLimitado ? productos.slice(0, 8) : productos;
            
            const subtitulo = document.createElement('div');
            subtitulo.className = 'categoria-subtitulo';
            subtitulo.textContent = mostrarLimitado && productos.length > 8 
                ? `${nombreCategoria.toUpperCase()} (mostrando ${productosAMostrar.length} de ${productos.length})` 
                : `${nombreCategoria.toUpperCase()} (${productosAMostrar.length})`;
            seccion.appendChild(subtitulo);

            const grid = document.createElement('div');
            grid.className = 'productos-grid';
            productosAMostrar.forEach(producto => grid.appendChild(crearProductoDiv(producto)));
            seccion.appendChild(grid);
        }
    });

    return seccion;
}

function crearProductoDiv(producto) {
    const div = document.createElement('div');
    div.className = 'producto';
    const imagenUrl = producto.imageUrl || 'https://via.placeholder.com/300?text=Sin+Imagen';
    const stock = producto.stock || 0;
    const stockClass = stock > 0 ? 'stock-disponible' : 'sin-stock';
    const stockTexto = stock > 0 ? `${stock} disponibles` : 'Agotado - Se fabrica bajo pedido';

    div.innerHTML = `
        <img src="${imagenUrl}" alt="${producto.title}" class="producto-imagen" onerror="this.src='https://via.placeholder.com/300?text=Error+Imagen'">
        <div class="producto-info">
            <h3>${producto.title || 'Producto sin nombre'}</h3>
            <p><strong>Categoría:</strong> ${producto.category || 'N/A'}</p>
            <div class="producto-precio">$${(producto.price || 0).toFixed(2)}</div>
            <p class="producto-stock ${stockClass}">📦 ${stockTexto}</p>
            <span class="producto-categoria">${producto.category || 'Producto'}</span>
        </div>
    `;

    div.style.cursor = 'pointer';
    div.onclick = () => abrirModal(producto);
    return div;
}

// ==================== MODALES Y CARRITO ====================

function abrirModal(producto) {
    productoActualModal = producto;
    
    document.getElementById('modal-imagen').src = producto.imageUrl || 'https://via.placeholder.com/400?text=Sin+Imagen';
    document.getElementById('modal-titulo').textContent = producto.title || 'Producto sin nombre';
    document.getElementById('modal-categoria').textContent = `Categoría: ${producto.category || 'N/A'}`;
    document.getElementById('modal-tipo').textContent = `Tipo: ${producto.type || 'N/A'}`;
    document.getElementById('modal-precio').textContent = `$${(producto.price || 0).toFixed(2)}`;
    
    const stock = producto.stock || 0;
    const stockDiv = document.getElementById('modal-stock');
    if (stock > 0) {
        stockDiv.textContent = `📦 ${stock} unidades listas para envío`;
        stockDiv.classList.remove('sin-stock');
        document.getElementById('cantidad').max = stock; 
    } else {
        stockDiv.textContent = '🛠️ Sin stock inmediato - ¡Haz tu pedido y lo fabricamos!';
        stockDiv.classList.add('sin-stock');
        document.getElementById('cantidad').removeAttribute('max'); 
    }
    
    document.getElementById('modal-descripcion').textContent = producto.description || 'Sin descripción disponible';
    document.getElementById('cantidad').value = 1;
    
    const modal = document.getElementById('modal-producto');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function cerrarModal() {
    const modal = document.getElementById('modal-producto');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    productoActualModal = null;
}

function actualizarContadorCarrito() {
    const contador = carrito.reduce((sum, item) => sum + parseInt(item.cantidad), 0);
    const contadorHTML = document.getElementById('contador-carrito');
    if(contadorHTML) contadorHTML.textContent = contador;
}

function agregarAlCarrito() {
    if (!productoActualModal) return;
    
    const cantidad = parseInt(document.getElementById('cantidad').value);
    if (cantidad <= 0 || isNaN(cantidad)) {
        alert('❌ Ingresa una cantidad válida');
        return;
    }
    
    const itemExistente = carrito.find(item => item.id === productoActualModal.id);
    
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
    } else {
        carrito.push({
            id: productoActualModal.id,
            title: productoActualModal.title,
            price: parseFloat(productoActualModal.price),
            imageUrl: productoActualModal.imageUrl,
            cantidad: cantidad // Guardado SIEMPRE como 'cantidad'
        });
    }
    
    // Guardar usando la llave dinámica del usuario
    localStorage.setItem(obtenerLlaveCarrito(), JSON.stringify(carrito));
    actualizarContadorCarrito();
    
    alert('✅ Producto agregado al carrito');
    cerrarModal();
}

function abrirCarrito() {
    const modal = document.getElementById('modal-carrito');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    mostrarCarrito();
}

function cerrarCarrito() {
    const modal = document.getElementById('modal-carrito');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function mostrarCarrito() {
    const container = document.getElementById('carrito-items');
    const carritoVacio = document.getElementById('carrito-vacio');
    const carritoResumen = document.getElementById('carrito-resumen');
    
    if (carrito.length === 0) {
        container.innerHTML = '';
        carritoVacio.classList.remove('hidden');
        carritoResumen.classList.add('hidden');
        return;
    }
    
    carritoVacio.classList.add('hidden');
    carritoResumen.classList.remove('hidden');
    
    let total = 0;
    container.innerHTML = carrito.map((item, index) => {
        const precio = parseFloat(item.price);
        const subtotal = precio * parseInt(item.cantidad);
        total += subtotal;
        
        return `
            <div class="carrito-item">
                <img src="${item.imageUrl}" alt="${item.title}" class="carrito-item-imagen">
                <div class="carrito-item-info">
                    <h4 class="carrito-item-titulo">${item.title}</h4>
                    <p class="carrito-item-precio">$${precio.toFixed(2)}</p>
                    <div class="carrito-item-controles">
                        <input type="number" min="1" value="${item.cantidad}" class="cantidad-input" onchange="actualizarCantidad(${index}, this.value)">
                        <button class="btn-eliminar-item" onclick="eliminarDelCarrito(${index})">🗑️ Eliminar</button>
                    </div>
                </div>
                <div style="text-align: right;">
                    <p style="color: #4caf50; font-weight: 700;">$${subtotal.toFixed(2)}</p>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('subtotal').textContent = `$${total.toFixed(2)}`;
    document.getElementById('total-carrito').textContent = `$${total.toFixed(2)}`;
}

function actualizarCantidad(index, nuevaCantidad) {
    nuevaCantidad = parseInt(nuevaCantidad);
    if (nuevaCantidad <= 0 || isNaN(nuevaCantidad)) {
        eliminarDelCarrito(index);
        return;
    }
    
    // CORRECCIÓN CLAVE: Usar 'cantidad', no 'quantity'
    carrito[index].cantidad = nuevaCantidad; 
    localStorage.setItem(obtenerLlaveCarrito(), JSON.stringify(carrito));
    actualizarContadorCarrito();
    mostrarCarrito();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    localStorage.setItem(obtenerLlaveCarrito(), JSON.stringify(carrito));
    actualizarContadorCarrito();
    mostrarCarrito();
}

async function procesarOrden(event) {
    event.preventDefault();
    
    if (carrito.length === 0) {
        alert('❌ El carrito está vacío');
        return;
    }
    
    const sessionStr = localStorage.getItem('sessionUser');
    
    // CORRECCIÓN: Evitar fallos si no hay input de cliente cuando está logueado
    let nombreCliente = "Invitado";
    let usuarioIdActual = "invitado";

    if(sessionStr) {
        const d = JSON.parse(sessionStr);
        nombreCliente = d.nombre;
        usuarioIdActual = d.usuario;
    } else {
        const inputNombre = document.getElementById('cliente-nombre');
        if(inputNombre) nombreCliente = inputNombre.value;
    }

    const email = document.getElementById('cliente-email') ? document.getElementById('cliente-email').value : "N/A";
    const telefono = document.getElementById('cliente-telefono') ? document.getElementById('cliente-telefono').value : "N/A";
    
    const total = carrito.reduce((sum, item) => sum + (item.price * item.cantidad), 0);
    
    const orden = {
        id: Date.now(),
        usuarioId: usuarioIdActual, // VINCLUACIÓN DEL USUARIO
        cliente: nombreCliente,
        email: email,
        telefono: telefono,
        fecha: new Date().toISOString(),
        productos: carrito.map(item => ({
            id: item.id,
            title: item.title,
            cantidad: item.cantidad,
            precio: item.price
        })),
        total: total,
        estado: 'pendiente'
    };
    
    try {
        const respuesta = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: orden.id.toString(), 
                usuarioId: orden.usuarioId, // Enviamos el ID al backend
                cliente: orden.cliente,
                email: orden.email,
                telefono: orden.telefono,
                fecha: orden.fecha,
                total: orden.total,
                completada: false,
                productos: orden.productos
            })
        });

        if (!respuesta.ok) throw new Error("Fallo al guardar en la nube");

        carrito = [];
        localStorage.setItem(obtenerLlaveCarrito(), JSON.stringify(carrito));
        actualizarContadorCarrito();
        
        alert(`✅ ¡Orden creada exitosamente!\n\nNúmero de orden: #${orden.id}\nTotal: $${orden.total.toFixed(2)}\n\nNos pondremos en contacto pronto.`);
        
        const formOrden = document.getElementById('formulario-orden');
        if(formOrden) formOrden.reset();
        
        cerrarCarrito();

    } catch(error) {
        console.error(error);
        alert('❌ Hubo un error al procesar tu orden. Intenta de nuevo.');
    }
}

// ==================== HISTORIAL DE PEDIDOS ====================

async function abrirHistorial() {
    const sessionStr = localStorage.getItem('sessionUser');
    if (!sessionStr) return;
    
    const usuario = JSON.parse(sessionStr).usuario;
    const modal = document.getElementById('modal-historial');
    const contenedor = document.getElementById('historial-lista');
    
    // Si no creaste el div en index.html, lo ignoramos para evitar crasheos
    if(!modal || !contenedor) {
        alert("Falta agregar el bloque HTML del modal-historial en tu index.html");
        return; 
    }

    modal.classList.add('active');
    contenedor.innerHTML = '<div class="loading"><div class="spinner"></div><p>Buscando tus pedidos...</p></div>';

    try {
        const respuesta = await fetch(`${API_URL}/orders/usuario/${usuario}`);
        if (!respuesta.ok) throw new Error("Error en la API");
        
        let ordenes = await respuesta.json();
        
        if (ordenes.length === 0) {
            contenedor.innerHTML = '<p class="carrito-vacio">Aún no has hecho ningún pedido. ¡Anímate a comprar!</p>';
            return;
        }

        ordenes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        contenedor.innerHTML = ordenes.map(orden => {
            const estadoClase = orden.completada ? 'estado-completada' : 'estado-pendiente';
            const estadoTexto = orden.completada ? '✅ COMPLETADO' : '⏳ EN PROCESO';
            const fecha = new Date(orden.fecha).toLocaleDateString();

            return `
                <div style="background-color: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                        <strong style="color: #f4a230;">Orden #${orden.id}</strong>
                        <span class="orden-estado ${estadoClase}" style="font-size: 0.8em; padding: 4px 8px;">${estadoTexto}</span>
                    </div>
                    <p style="color: #ccc; margin: 5px 0;">Fecha: ${fecha}</p>
                    <p style="color: #ccc; margin: 5px 0;">Total: <strong style="color: #4caf50;">$${orden.total.toFixed(2)}</strong></p>
                    <div style="margin-top: 10px; font-size: 0.9em; color: #999;">
                        ${orden.productos.map(p => `• ${p.cantidad}x ${p.title}`).join('<br>')}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        contenedor.innerHTML = '<p style="color: #f44336; text-align: center;">Hubo un problema al cargar el historial. Asegúrate de haber actualizado el backend.</p>';
    }
}

async function abrirHistorial() {
    const sessionStr = localStorage.getItem('sessionUser');
    if (!sessionStr) return;
    
    const usuario = JSON.parse(sessionStr).usuario;
    const modal = document.getElementById('modal-historial');
    const contenedor = document.getElementById('historial-lista');
    
    if(!modal || !contenedor) return;

    modal.classList.add('active');
    contenedor.innerHTML = '<div class="loading"><div class="spinner"></div><p>Buscando tus pedidos...</p></div>';

    try {
        const respuesta = await fetch(`${API_URL}/orders/usuario/${usuario}`);
        if (!respuesta.ok) throw new Error("Error en la API");
        
        let ordenes = await respuesta.json();
        
        if (ordenes.length === 0) {
            contenedor.innerHTML = '<p class="carrito-vacio">Aún no has hecho ningún pedido. ¡Anímate a comprar!</p>';
            return;
        }

        // Ordenar de la más reciente a la más antigua
        ordenes.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        contenedor.innerHTML = ordenes.map(orden => {
            const estadoClase = orden.completada ? 'estado-completada' : 'estado-pendiente';
            const estadoTexto = orden.completada ? '✅ COMPLETADO' : '⏳ EN PROCESO';
            const fecha = new Date(orden.fecha).toLocaleDateString();

            return `
                <div style="background-color: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                        <strong style="color: #f4a230;">Orden #${orden.id}</strong>
                        <span class="orden-estado ${estadoClase}" style="font-size: 0.8em; padding: 4px 8px;">${estadoTexto}</span>
                    </div>
                    <p style="color: #ccc; margin: 5px 0;">Fecha: ${fecha}</p>
                    <p style="color: #ccc; margin: 5px 0;">Total: <strong style="color: #4caf50;">$${orden.total.toFixed(2)}</strong></p>
                    <div style="margin-top: 10px; font-size: 0.9em; color: #999;">
                        ${orden.productos.map(p => `• ${p.cantidad}x ${p.title}`).join('<br>')}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        contenedor.innerHTML = '<p style="color: #f44336; text-align: center;">Hubo un problema al cargar el historial. Asegúrate de haber actualizado el backend.</p>';
    }
}