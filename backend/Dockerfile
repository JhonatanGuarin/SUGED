# Usamos la misma imagen ligera de Node.js
FROM node:20-alpine

WORKDIR /app

# Copiamos primero los archivos de dependencias
COPY package*.json ./

RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto que usará nuestra API
EXPOSE 3000

# Comando para iniciar en modo desarrollo con recarga automática
CMD ["npm", "run", "dev"]