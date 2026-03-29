FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
EXPOSE 4011

COPY dist ./dist

CMD ["node", "dist/index.cjs"]
