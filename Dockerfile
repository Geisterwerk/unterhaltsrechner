FROM node:22-alpine
WORKDIR /app

# Abhängigkeiten zuerst (Layer-Cache)
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
