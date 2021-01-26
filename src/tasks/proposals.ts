import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { Contract } from "ethers";
import { task, types } from "hardhat/config";
import { readFileSync } from "fs";

interface Proposal {
    id: string,
    txs: ModuleTransaction[]
}

interface ExtendedProposal extends Proposal {
    txsHashes: string[]
}

interface ModuleTransaction {
    to: string,
    value: string,
    data: string,
    operation: number
}

const getProposalDetails = async (module: Contract, path: string): Promise<ExtendedProposal> => {
    const proposal: Proposal = JSON.parse(readFileSync(path, "utf-8"))
    const txsHashes = await Promise.all(proposal.txs.map(async (tx) => {
        return await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation)
    }));
    return {
        ...proposal,
        txsHashes
    }
}

task("addProposal", "Adds a proposal question")
        .addParam("module", "Address of the module", undefined, types.string)
        .addParam("proposalFile", "File with proposal information json", undefined, types.inputFile)
        .setAction(async (taskArgs, hardhatRuntime) => {
            const ethers = hardhatRuntime.ethers;
            const Module = await ethers.getContractFactory("DaoModule");
            const module = await Module.attach(taskArgs.module);

            const proposal = await getProposalDetails(module, taskArgs.proposalFile);

            const tx = await module.addProposal(proposal.id, proposal.txsHashes);
            console.log("Transaction:", tx.hash);
        });

task("showProposal", "Shows proposal quesion details")
        .addParam("module", "Address of the module", undefined, types.string)
        .addParam("proposalFile", "File with proposal information json", undefined, types.inputFile)
        .setAction(async (taskArgs, hardhatRuntime) => {
            const ethers = hardhatRuntime.ethers;
            const Module = await ethers.getContractFactory("DaoModule");
            const module = await Module.attach(taskArgs.module);

            const proposal = await getProposalDetails(module, taskArgs.proposalFile);

            const txHashesImages = ethers.utils.solidityPack(["bytes32[]"], [proposal.txsHashes])
            const txHashesHash = ethers.utils.keccak256(txHashesImages)

            console.log("### Proposal ####");
            console.log("ID:", proposal.id);
            console.log("Transactions hashes hash:", txHashesHash);
            console.log("Transactions hashes:", proposal.txsHashes);
            console.log("Transactions:", proposal.txs);
        });

task("markProposalAsReady", "Mark a proposal question as answered and ready for execution")
        .addParam("module", "Address of the module", undefined, types.string)
        .addParam("proposalFile", "File with proposal information json", undefined, types.inputFile)
        .setAction(async (taskArgs, hardhatRuntime) => {
            const ethers = hardhatRuntime.ethers;
            const Module = await ethers.getContractFactory("DaoModule");
            const module = await Module.attach(taskArgs.module);

            const proposal = await getProposalDetails(module, taskArgs.proposalFile);

            const tx = await module.requestProposalReadyForExecution(proposal.id, proposal.txsHashes);
            console.log("Transaction:", tx.hash);
        });

task("executeProposal", "Executes a proposal")
        .addParam("module", "Address of the module", undefined, types.string)
        .addParam("question", "Id of the question for the proposal", undefined, types.string)
        .addParam("proposalFile", "File with proposal information json", undefined, types.inputFile)
        .setAction(async (taskArgs, hardhatRuntime) => {
            const ethers = hardhatRuntime.ethers;
            const Module = await ethers.getContractFactory("DaoModule");
            const module = await Module.attach(taskArgs.module);

            const proposal = await getProposalDetails(module, taskArgs.proposalFile);

            for (const moduleTx of proposal.txs) {
                const tx = await module.executeProposal(taskArgs.question, proposal.id, proposal.txsHashes, moduleTx.to, moduleTx.value, moduleTx.data, moduleTx.operation);
                console.log("Transaction:", tx.hash);
            }
        });

export { };