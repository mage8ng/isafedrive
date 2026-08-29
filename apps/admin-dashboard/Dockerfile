FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build -w apps/admin-dashboard
EXPOSE 3100
CMD ["npm", "--workspace", "apps/admin-dashboard", "exec", "next", "start"]
