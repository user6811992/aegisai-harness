FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY README.md ROADMAP.md llms.txt ./
RUN mkdir -p /app/data && chown -R node:node /app/data
ENV PORT=8080 HOST=0.0.0.0
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+process.env.PORT+'/api/version',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
USER node
CMD ["node", "src/index.js", "--web"]
