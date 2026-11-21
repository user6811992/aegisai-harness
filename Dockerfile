FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY README.md ROADMAP.md llms.txt ./
ENV PORT=8080 HOST=0.0.0.0
EXPOSE 8080
CMD ["node", "src/index.js", "--web"]
