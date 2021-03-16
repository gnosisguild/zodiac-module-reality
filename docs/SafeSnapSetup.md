# Setup a SafeSnap DAO

1. Deploy your [Gnosis Safe](https://gnosis-safe.io).

2. Modify the question template at `src/tasks/defaultTemplate.json` to suit your DAO.

3. `yarn build`

4. `yarn hardhat --network <network> createDaoTemplate --oracle <oracle_address>`

5. `yarn hardhat --network <network> setup --dao <safe_address> --oracle <realitio_address> --timeout 172800 --cooldown 86400`

6. Enable module (e.g. with transaction builder and abi from `0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F`)

7. Set up your Snapshot instance, make sure to include `"plugins": { "daoModule": { "address": "<module_address"} }` in your `index.json` file.
