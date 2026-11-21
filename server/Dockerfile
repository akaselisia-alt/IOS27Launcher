FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
# Only turn this on behind an HTTPS proxy / host that sets X-Forwarded-For:
ENV TRUST_PROXY=1
VOLUME /data
USER node
EXPOSE 8080
CMD ["node", "server.js"]
