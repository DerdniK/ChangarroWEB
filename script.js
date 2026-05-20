async function obtenerProductos() {
            try {
                // 1. Hacemos la petición a tu API local
                const respuesta = await fetch('http://localhost:5253/api/v1/products');
                
                // 2. Convertimos la respuesta de texto a un objeto JSON
                const productos = await respuesta.json();
                
                // 3. Seleccionamos el div donde pondremos los datos
                const contenedor = document.getElementById('contenedor-productos');
                contenedor.innerHTML = ''; // Limpiamos antes de cargar

                // 4. Recorremos los productos y creamos HTML dinámico
                productos.forEach(producto => {
                    const div = document.createElement('div');
                    div.className = 'producto';
                    // Usamos las propiedades exactas de tu JSON (title, price, stock)
                    div.innerHTML = `
                        <h3>${producto.title}</h3>
                        <p><strong>Categoría:</strong> ${producto.category}</p>
                        <p><strong>Precio:</strong> $${producto.price}</p>
                        <p><strong>Stock:</strong> ${producto.stock} unidades</p>
                        <iframe src="${producto.ImageUrl}" width="100%" height="600px"></iframe>
                    `;
                    contenedor.appendChild(div);
                });

            } catch (error) {
                console.error("Hubo un error al conectar con la API:", error);
                document.getElementById('contenedor-productos').innerHTML = "<p>Error al cargar el catálogo.</p>";
            }
        }