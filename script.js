// Validar sesión al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    verificarSesion();
    actualizarContadorCarrito();
});

function verificarSesion() {
    const sessionStr = localStorage.getItem('sessionUser');
    const headerAcciones = document.getElementById('header-acciones');

    // Si por alguna razón no encuentra el contenedor, detenemos la función para evitar errores
    if (!headerAcciones) return; 

    if (sessionStr) {
        const usuario = JSON.parse(sessionStr);
        let htmlBotones = `
            <span style="color: #f4a230; font-weight: bold; font-size: 1.2em; margin-right: 15px;">👋 Hola, ${usuario.nombre}</span>
            <button class="btn-carrito" onclick="abrirCarrito()">🛒 Carrito (<span id="contador-carrito">0</span>)</button>
        `;

        if (usuario.esAdmin) {
            htmlBotones += `<a href="admin.html" class="btn-admin" style="margin-left: 10px;">⚙️ Panel Admin</a>`;
        }

        htmlBotones += `<button onclick="cerrarSesionGlobal()" style="padding: 12px 25px; margin-left: 10px; background-color: #f44336; color: white; border: none; border-radius: 50px; font-weight: 600; cursor: pointer;">Cerrar Sesión</button>`;

        headerAcciones.innerHTML = htmlBotones;
    } else {
        headerAcciones.innerHTML = `
            <button class="btn-carrito" onclick="abrirCarrito()">🛒 Carrito (<span id="contador-carrito">0</span>)</button>
            <a href="admin.html" class="btn-admin" style="margin-left: 10px;">🔐 Iniciar Sesión</a>
        `;
    }
}

function cerrarSesionGlobal() {
    localStorage.removeItem('sessionUser');
    window.location.reload(); 
}

// Mapeo de tipos para organizar los productos
const tiposCatalogo = [
    { id: 'poster', nombre: '📄 Posters', icon: '📄' },
    { id: 'postal', nombre: '✉️ Postales', icon: '✉️' },
    { id: 'mini-poster', nombre: '📌 Mini Posters', icon: '📌' },
    { id: 'botón', nombre: '🔘 Botones', icon: '🔘' },
    { id: 'sticker', nombre: '✨ Stickers', icon: '✨' },
    { id: 'pin', nombre: '📍 Pines', icon: '📍' }
];

// Variable para almacenar productos agrupados
let productosAgrupados = {};
let filtroActual = null; // null = mostrar todas, o id de tipo específico
let productoActualModal = null; // Producto abierto en modal
const API_URL = 'https://3ulergkxc7.execute-api.us-east-1.amazonaws.com/default/api/v1';

// Carrito de compras
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];

// Actualizar contador del carrito
function actualizarContadorCarrito() {
    const contador = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    document.getElementById('contador-carrito').textContent = contador;
}

async function obtenerProductos() {
    try {
        // Mostrar estado de carga
        const contenedor = document.getElementById('contenedor-productos');
        contenedor.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando catálogo...</p></div>';

        // Hacer petición a la API
        const respuesta = await fetch(`${API_URL}/products`);
        
        if (!respuesta.ok) {
            throw new Error('No se pudo conectar con la API');
        }

        const productos = await respuesta.json();

        // Log de depuración
        console.log("Productos recibidos:", productos);
        console.log("Número de productos:", productos.length);
        if (productos.length > 0) {
            console.log("Ejemplo de producto:", productos[0]);
        }

        // Validar que tenemos productos
        if (!Array.isArray(productos) || productos.length === 0) {
            contenedor.innerHTML = '<p class="sin-productos">No hay productos disponibles en el catálogo.</p>';
            return;
        }

        // Asegurar que los precios sean números
        const productosValidados = productos.map(p => ({
            ...p,
            price: parseFloat(p.price),
            stock: parseInt(p.stock)
        }));

        // Organizar productos por tipo y categoría
        productosAgrupados = agruparProductosPorTipo(productosValidados);
        console.log("Productos agrupados:", productosAgrupados);

        // Crear botones de filtro
        crearBotonesFiltro();

        // Mostrar todas los tipos con límite de 8 elementos
        filtroActual = null;
        mostrarProductos();

    } catch (error) {
        console.error("Error al conectar con la API:", error);
        document.getElementById('contenedor-productos').innerHTML = 
            '<div class="error-message">❌ Error al cargar el catálogo. Por favor, verifica que el servidor esté activo.</div>';
    }
}

function agruparProductosPorTipo(productos) {
    const agrupados = {};
    
    // Inicializar grupos por tipo
    tiposCatalogo.forEach(tipo => {
        agrupados[tipo.id] = {};
    });

    // Clasificar productos según su tipo y categoría
    productos.forEach(producto => {
        const tipo = (producto.type || '').toLowerCase().trim();
        const categoria = (producto.category || 'Sin categoría').toLowerCase().trim();
        
        console.log(`Producto: "${producto.title}" | Tipo: "${tipo}" | Categoría: "${categoria}"`);
        
        // Buscar el tipo en nuestro catálogo
        const tipoEncontrado = tiposCatalogo.find(t => 
            t.id.includes(tipo) || tipo.includes(t.id)
        );
        
        if (tipoEncontrado) {
            console.log(`✓ Clasificado en tipo: ${tipoEncontrado.nombre}`);
            // Crear categoría si no existe
            if (!agrupados[tipoEncontrado.id][categoria]) {
                agrupados[tipoEncontrado.id][categoria] = [];
            }
            agrupados[tipoEncontrado.id][categoria].push(producto);
        } else {
            console.log(`✗ Tipo no reconocido: "${tipo}"`);
        }
    });

    return agrupados;
}

function crearBotonesFiltro() {
    const contenedorBotones = document.getElementById('botones-filtro');
    contenedorBotones.innerHTML = '';

    // Botón para ver todos
    const btnTodos = document.createElement('button');
    btnTodos.className = 'btn-filtro btn-todos active';
    btnTodos.textContent = '🎨 Todos los Productos';
    btnTodos.onclick = () => {
        filtroActual = null;
        mostrarProductos();
        actualizarBotonesFiltro();
    };
    contenedorBotones.appendChild(btnTodos);

    // Botones por tipo
    tiposCatalogo.forEach(tipo => {
        // Contar total de productos en este tipo
        const totalProductos = Object.values(productosAgrupados[tipo.id] || {})
            .reduce((sum, arr) => sum + arr.length, 0);
        
        // Solo mostrar botón si hay productos en ese tipo
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
        // Mostrar todos los tipos con 8 elementos máximo por categoría
        tiposCatalogo.forEach(tipo => {
            const categoriasDelTipo = productosAgrupados[tipo.id] || {};
            
            // Contar total de productos en este tipo
            const totalProductos = Object.values(categoriasDelTipo)
                .reduce((sum, arr) => sum + arr.length, 0);
            
            if (totalProductos > 0) {
                hayProductos = true;
                const seccionTipo = crearSeccionTipo(tipo, categoriasDelTipo, true);
                contenedor.appendChild(seccionTipo);
            }
        });
    } else {
        // Mostrar solo el tipo filtrado (sin límite)
        const tipo = tiposCatalogo.find(t => t.id === filtroActual);
        const categoriasDelTipo = productosAgrupados[filtroActual] || {};
        
        const totalProductos = Object.values(categoriasDelTipo)
            .reduce((sum, arr) => sum + arr.length, 0);
        
        if (totalProductos > 0) {
            hayProductos = true;
            const seccionTipo = crearSeccionTipo(tipo, categoriasDelTipo, false);
            contenedor.appendChild(seccionTipo);
        }
    }

    // Si no hay productos
    if (!hayProductos) {
        contenedor.innerHTML = '<p class="sin-productos">No hay productos en esta categoría.</p>';
    }
}

function crearSeccionTipo(tipo, categorias, mostrarLimitado) {
    const seccion = document.createElement('div');
    seccion.className = 'tipo-seccion';

    // Título del tipo
    const titulo = document.createElement('div');
    titulo.className = 'tipo-titulo';
    titulo.textContent = tipo.nombre;
    seccion.appendChild(titulo);

    // Para cada categoría dentro del tipo
    Object.entries(categorias).forEach(([nombreCategoria, productos]) => {
        if (productos.length > 0) {
            // Limitar a 8 si estamos en vista de todos
            const productosAMostrar = mostrarLimitado ? productos.slice(0, 8) : productos;
            
            // Subtítulo de categoría
            const subtitulo = document.createElement('div');
            subtitulo.className = 'categoria-subtitulo';
            
            if (mostrarLimitado && productos.length > 8) {
                subtitulo.textContent = `${nombreCategoria.toUpperCase()} (mostrando ${productosAMostrar.length} de ${productos.length})`;
            } else {
                subtitulo.textContent = `${nombreCategoria.toUpperCase()} (${productosAMostrar.length})`;
            }
            
            seccion.appendChild(subtitulo);

            // Grid de productos
            const grid = document.createElement('div');
            grid.className = 'productos-grid';

            productosAMostrar.forEach(producto => {
                const productoDiv = crearProductoDiv(producto);
                grid.appendChild(productoDiv);
            });

            seccion.appendChild(grid);
        }
    });

    return seccion;
}

function crearProductoDiv(producto) {
    const div = document.createElement('div');
    div.className = 'producto';

    // Validar imagen
    const imagenUrl = producto.imageUrl || 'https://via.placeholder.com/300?text=Sin+Imagen';
    
    // Determinar estado de stock
    const stock = producto.stock || 0;
    const stockClass = stock > 0 ? 'stock-disponible' : 'sin-stock';
    // AQUÍ CAMBIAMOS EL MENSAJE:
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

    // Agregar evento de clic para abrir modal
    div.style.cursor = 'pointer';
    div.onclick = () => abrirModal(producto);

    return div;
}

// ==================== FUNCIONES DEL MODAL ====================
function abrirModal(producto) {
    productoActualModal = producto;
    
    // Llenar datos del modal
    document.getElementById('modal-imagen').src = producto.imageUrl || 'https://via.placeholder.com/400?text=Sin+Imagen';
    document.getElementById('modal-titulo').textContent = producto.title || 'Producto sin nombre';
    document.getElementById('modal-categoria').textContent = `Categoría: ${producto.category || 'N/A'}`;
    document.getElementById('modal-tipo').textContent = `Tipo: ${producto.type || 'N/A'}`;
    document.getElementById('modal-precio').textContent = `$${(producto.price || 0).toFixed(2)}`;
    
    // Stock
    const stock = producto.stock || 0;
    const stockDiv = document.getElementById('modal-stock');
    if (stock > 0) {
        stockDiv.textContent = `📦 ${stock} unidades listas para envío`;
        stockDiv.classList.remove('sin-stock');
        document.getElementById('cantidad').max = stock; // Límite normal
    } else {
        // AQUÍ CAMBIAMOS EL COMPORTAMIENTO:
        stockDiv.textContent = '🛠️ Sin stock inmediato - ¡Haz tu pedido y lo fabricamos!';
        stockDiv.classList.add('sin-stock');
        document.getElementById('cantidad').removeAttribute('max'); // Quitamos el límite para que puedan pedir
    }
    
    // Descripción
    const descripcion = producto.description || 'Sin descripción disponible';
    document.getElementById('modal-descripcion').textContent = descripcion;
    
    // Reset cantidad
    document.getElementById('cantidad').value = 1;
    
    // Mostrar modal
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

function agregarAlCarrito() {
    if (!productoActualModal) return;
    
    const cantidad = parseInt(document.getElementById('cantidad').value);
    if (cantidad <= 0) {
        alert('❌ Ingresa una cantidad válida');
        return;
    }
    
    // Verificar si el producto ya está en el carrito
    const itemExistente = carrito.find(item => item.id === productoActualModal.id);
    
    if (itemExistente) {
        itemExistente.cantidad += cantidad;
    } else {
        carrito.push({
            id: productoActualModal.id,
            title: productoActualModal.title,
            price: parseFloat(productoActualModal.price),
            imageUrl: productoActualModal.imageUrl,
            cantidad: cantidad
        });
    }
    
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarContadorCarrito();
    
    alert('✅ Producto agregado al carrito');
    cerrarModal();
}

// ==================== FUNCIONES DEL CARRITO ====================
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
    if (nuevaCantidad <= 0) {
        eliminarDelCarrito(index);
        return;
    }
    
    carrito[index].quantity = nuevaCantidad;
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarContadorCarrito();
    mostrarCarrito();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    localStorage.setItem('carrito', JSON.stringify(carrito));
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
    const nombreCliente = sessionStr ? JSON.parse(sessionStr).nombre : document.getElementById('cliente-nombre').value;
    const email = document.getElementById('cliente-email').value;
    const telefono = document.getElementById('cliente-telefono').value;
    const direccion = document.getElementById('cliente-direccion').value;
    
    // Calcular total
    const total = carrito.reduce((sum, item) => sum + (item.price * item.cantidad), 0);
    
    // Crear orden
    const orden = {
        id: Date.now(),
        cliente: nombre,
        email: email,
        telefono: telefono,
        direccion: direccion,
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
    // 1. Enviar la orden a DynamoDB mediante la API
    const respuesta = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: orden.id.toString(), // Dynamo prefiere strings en los IDs a veces
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

    // 2. Limpiar todo si fue exitoso
    carrito = [];
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarContadorCarrito();
    
    alert(`✅ ¡Orden creada exitosamente!\n\nNúmero de orden: #${orden.id}\nTotal: $${orden.total.toFixed(2)}\n\nNos pondremos en contacto pronto.`);
    
    document.getElementById('formulario-orden').reset();
    cerrarCarrito();

} catch(error) {
    console.error(error);
    alert('❌ Hubo un error al procesar tu orden. Intenta de nuevo.');
}
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
    actualizarContadorCarrito();
    
    // Cerrar modales con ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            cerrarModal();
            cerrarCarrito();
        }
    });
    
    // Cerrar modal de producto al hacer clic fuera
    const modalProducto = document.getElementById('modal-producto');
    modalProducto.addEventListener('click', function(e) {
        if (e.target === modalProducto) {
            cerrarModal();
        }
    });
    
    // Cerrar modal de carrito al hacer clic fuera
    const modalCarrito = document.getElementById('modal-carrito');
    modalCarrito.addEventListener('click', function(e) {
        if (e.target === modalCarrito) {
            cerrarCarrito();
        }
    });
});