# Usamos una imagen oficial y ligera de Node.js
FROM node:20-alpine

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos solo los archivos de dependencias primero (optimiza el caché de Docker)
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del código de la aplicación
COPY . .

# Exponemos el puerto que usa Vite
EXPOSE 5173

# Comando para iniciar el servidor de desarrollo de Vite
# El --host es vital para que Vite sea accesible desde fuera del contenedor
CMD ["npm", "run", "dev", "--", "--host"]