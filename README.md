# docker-node
A sample of node application running in docker container.

# Run docker container by 
$ docker run -dp 3000:8080 \
    -w /app/docker-node -v "$(pwd):/app/docker-node" \
    lqwangxg/node:alpine \
    sh -c "npm install -g nodemon && npm install &&  nodemon index.js"
