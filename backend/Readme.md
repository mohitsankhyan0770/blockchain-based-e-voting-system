# Running the project

## Required:

- .env file (with ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET variables)
- mysql database (edit the ormconfig.json)
 { tokens will be generated when you run this project and try to login with admin id
  john@gmail.com password john@gmail.com  
  after that add it to env file and restart backend}
  
## Run migration with:

```
npm run typeorm migration:run
```

## API End-Points

- /auth/login
- /auth/check
- /auth/logout
- /auth/signup
- /polls/
- /polls/start
- /polls/status
- /polls/end
- /polls/reset
- /polls/voters
- /polls/vote
- /users/all
- /users/verify
- /users/delete/:id
