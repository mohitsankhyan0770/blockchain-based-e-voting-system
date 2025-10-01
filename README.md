# blockchain-based-e-voting-system
project was made while keeping in mind that it can be implemented in colleges and small scale elections to enhance trust and transparency and prevent vote tempering.
it also implements hashing to save user created passwords to prevent organization level identity theft.

what to install before proceeding?

mysql, node, ts, ganache, solidity, truffle.

How to Run?
Have an instance of Mqsql;
 and run the following commands; (NOTE: username and password for root user can be changed in ormconfig.json)

1. create user bbvs@localhost identified with mysql_native_password by 'Password00$$' ;

2. grant all privileges on . to bbvs@localhost ;

3. create database bbvs;
   
4.use bbvs;

(run an instance of ganache and connect this DAPP to the ganache to use the ethereum Testnet( for free block/transactions on Ether network)
{how to connect:- 

1. open ganache 
2. create a new workspace , 
3. Navigate to your backend folder of this repo and locate truffleconfig.json , select it and your are good to go.
     }

//in backend folder run;

5. truffle migrate

6. truffle migrate --reset

7. (check ReadMe of backend folder{intresting things there (important to run the project successfully)

(now start your backend node index.js and npm start in frontend dir in terminal)
create and contest elections and let your vote speak for you.
