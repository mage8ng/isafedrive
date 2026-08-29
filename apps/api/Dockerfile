FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build -w packages/shared && npm run build -w apps/api
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
