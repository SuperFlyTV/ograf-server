FROM node:18-alpine

WORKDIR /app
COPY . .

RUN chmod +x /app/osc-entrypoint.sh

ENV PORT=8080
ENTRYPOINT ["/app/osc-entrypoint.sh"]
CMD ["npm", "start"]
