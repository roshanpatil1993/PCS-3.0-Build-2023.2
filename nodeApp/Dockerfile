FROM node:16

# Create app directory
WORKDIR /web_server

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
RUN npm cache clean --force 
RUN npm config set legacy-peer-deps true
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 5000
CMD [ "node", "./bin/www" ]