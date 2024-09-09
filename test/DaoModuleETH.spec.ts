import { expect } from 'chai'
import hre, { ethers } from 'hardhat'
import '@nomicfoundation/hardhat-ethers'
import { buildMockInitializerParams, nextBlockTime } from './utils'
import { _TypedDataEncoder } from '@ethersproject/hash'
import { Contract, ZeroAddress } from 'ethers'

const EIP712_TYPES = {
  Transaction: [
    {
      name: 'to',
      type: 'address',
    },
    {
      name: 'value',
      type: 'uint256',
    },
    {
      name: 'data',
      type: 'bytes',
    },
    {
      name: 'operation',
      type: 'uint8',
    },
    {
      name: 'nonce',
      type: 'uint256',
    },
  ],
}

const INVALIDATED_STATE =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
const ZERO_STATE =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

describe('RealityModuleETH', async () => {
  async function baseSetup() {
    const Avatar = await hre.ethers.getContractFactory('TestAvatar')
    const avatar = await Avatar.deploy()
    const Mock = await hre.ethers.getContractFactory('MockContract')
    const mock = await Mock.deploy()
    await mock.waitForDeployment()
    const oracle = await hre.ethers.getContractAt(
      'RealitioV3ETH',
      await mock.getAddress(),
    )
    return { Avatar, avatar, module, mock, oracle }
  }

  const setupTestWithTestAvatar = async () => {
    const base = await baseSetup()
    const Module = await hre.ethers.getContractFactory('RealityModuleETH')
    const module = await Module.deploy(
      await base.avatar.getAddress(),
      await base.avatar.getAddress(),
      await base.avatar.getAddress(),
      await base.mock.getAddress(),
      42,
      23,
      0,
      0,
      1337,
      await base.mock.getAddress(),
    )
    return { ...base, Module, module }
  }

  const setupTestWithMockAvatar = async () => {
    const base = await baseSetup()
    const Module = await hre.ethers.getContractFactory('RealityModuleETH')
    const module = await Module.deploy(
      await base.mock.getAddress(),
      await base.mock.getAddress(),
      await base.mock.getAddress(),
      await base.mock.getAddress(),
      42,
      23,
      0,
      0,
      1337,
      await base.mock.getAddress(),
    )
    return { ...base, Module, module }
  }
  const [user1] = await ethers.getSigners()
  const user1Address = await user1.getAddress()
  describe('setUp', () => {
    it('throws if is already initialized', async () => {
      const { mock } = await baseSetup()
      const Module = await hre.ethers.getContractFactory('RealityModuleETH')
      const module = await Module.deploy(
        user1Address,
        user1Address,
        user1Address,
        user1Address,
        42,
        23,
        0,
        0,
        1337,
        user1Address,
      )
      await expect(
        module.setUp(
          await buildMockInitializerParams(mock as unknown as Contract),
        ),
      ).to.be.revertedWithCustomError(module, 'InvalidInitialization()')
    })

    it('throws if avatar is zero address', async () => {
      const Module = await hre.ethers.getContractFactory('RealityModuleETH')
      await expect(
        Module.deploy(
          user1Address,
          ZERO_ADDRESS,
          user1Address,
          user1Address,
          42,
          23,
          0,
          0,
          1337,
          user1Address,
        ),
      ).to.be.revertedWith('Avatar can not be zero address')
    })

    it('throws if target is zero address', async () => {
      const Module = await hre.ethers.getContractFactory('RealityModuleETH')
      await expect(
        Module.deploy(
          user1Address,
          user1Address,
          ZERO_ADDRESS,
          user1Address,
          42,
          23,
          0,
          0,
          1337,
          user1Address,
        ),
      ).to.be.revertedWith('Target can not be zero address')
    })

    it('throws if timeout is 0', async () => {
      const Module = await hre.ethers.getContractFactory('RealityModuleETH')
      await expect(
        Module.deploy(
          user1Address,
          user1Address,
          user1Address,
          user1Address,
          0,
          10,
          100,
          100,
          1,
          user1Address,
        ),
      ).to.be.revertedWith('Timeout has to be greater 0')
    })

    it('throws if not enough time between cooldown and expiration', async () => {
      const Module = await hre.ethers.getContractFactory('RealityModuleETH')
      await expect(
        Module.deploy(
          user1Address,
          user1Address,
          user1Address,
          user1Address,
          1,
          0,
          59,
          0,
          0,
          user1Address,
        ),
      ).to.be.revertedWith(
        'There need to be at least 60s between end of cooldown and expiration',
      )
    })

    it('answer expiration can be 0', async () => {
      const Module = await hre.ethers.getContractFactory('RealityModuleETH')
      await Module.deploy(
        user1Address,
        user1Address,
        user1Address,
        user1Address,
        1,
        10,
        0,
        0,
        0,
        user1Address,
      )
    })

    it.skip('should emit event because of successful set up', async () => {
      const Module = await hre.ethers.getContractFactory('RealityModuleETH')
      const [user1] = await hre.ethers.getSigners()

      await expect(
        Module.deploy(
          user1.address,
          user1.address,
          user1.address,
          user1.address,
          1,
          10,
          0,
          0,
          0,
          user1.address,
        ),
      )
        .to.emit(Module, 'RealityModuleSetup')
        .withArgs(user1.address, user1.address, user1.address, user1.address)
    })
  })

  describe('setQuestionTimeout', async () => {
    it('throws if not authorized', async () => {
      const { module } = await setupTestWithTestAvatar()
      await expect(module.setQuestionTimeout(2)).to.be.revertedWithCustomError(
        module,
        'OwnableUnauthorizedAccount',
      )

      it('throws if timeout is 0', async () => {
        const { avatar, module } = await setupTestWithTestAvatar()
        const calldata = module.interface.encodeFunctionData(
          'setQuestionTimeout',
          [0],
        )
        await expect(
          avatar.exec(await module.getAddress(), 0, calldata),
        ).to.be.revertedWith('Timeout has to be greater 0')
      })

      it('updates question timeout', async () => {
        const { module, avatar } = await setupTestWithTestAvatar()

        expect(await module.questionTimeout()).to.be.equals(42)

        const calldata = module.interface.encodeFunctionData(
          'setQuestionTimeout',
          [511],
        )
        await avatar.exec(await module.getAddress(), 0, calldata)

        expect(await module.questionTimeout()).to.be.equals(511)
      })
    })

    describe('setQuestionCooldown', async () => {
      it('throws if not authorized', async () => {
        const { module } = await setupTestWithTestAvatar()
        await expect(
          module.setQuestionCooldown(2),
        ).to.be.revertedWithCustomError(module, 'OwnableUnauthorizedAccount')
      })

      it('throws if not enough time between cooldown and expiration', async () => {
        const { module, avatar } = await setupTestWithTestAvatar()

        const setAnswerExpiration = module.interface.encodeFunctionData(
          'setAnswerExpiration',
          [100],
        )
        await avatar.exec(await module.getAddress(), 0, setAnswerExpiration)

        const setQuestionCooldownInvalid = module.interface.encodeFunctionData(
          'setQuestionCooldown',
          [41],
        )
        await expect(
          avatar.exec(await module.getAddress(), 0, setQuestionCooldownInvalid),
        ).to.be.revertedWith(
          'There need to be at least 60s between end of cooldown and expiration',
        )

        const setQuestionCooldown = module.interface.encodeFunctionData(
          'setQuestionCooldown',
          [40],
        )
        await avatar.exec(await module.getAddress(), 0, setQuestionCooldown)

        expect(await module.questionCooldown()).to.be.equals(40)
      })

      it('can reset to 0', async () => {
        const { module, avatar } = await setupTestWithTestAvatar()

        const setAnswerExpiration = module.interface.encodeFunctionData(
          'setAnswerExpiration',
          [100],
        )
        await avatar.exec(await module.getAddress(), 0, setAnswerExpiration)

        const setQuestionCooldown = module.interface.encodeFunctionData(
          'setQuestionCooldown',
          [40],
        )
        await avatar.exec(await module.getAddress(), 0, setQuestionCooldown)

        expect(await module.questionCooldown()).to.be.equals(40)

        const resetQuestionCooldown = module.interface.encodeFunctionData(
          'setQuestionCooldown',
          [0],
        )
        await avatar.exec(await module.getAddress(), 0, resetQuestionCooldown)

        expect(await module.questionCooldown()).to.be.equals(0)
      })

      it('updates question cooldown', async () => {
        const { module, avatar } = await setupTestWithTestAvatar()

        expect(await module.questionCooldown()).to.be.equals(23)

        const calldata = module.interface.encodeFunctionData(
          'setQuestionCooldown',
          [511],
        )
        await avatar.exec(await module.getAddress(), 0, calldata)

        expect(await module.questionCooldown()).to.be.equals(511)
      })
    })

    describe('setAnswerExpiration', async () => {
      it('throws if not authorized', async () => {
        const { module } = await setupTestWithTestAvatar()
        await expect(
          module.setAnswerExpiration(2),
        ).to.be.revertedWithCustomError(module, 'OwnableUnauthorizedAccount')
      })

      it('throws if not enough time between cooldown and expiration', async () => {
        const { module, avatar } = await setupTestWithTestAvatar()

        const setQuestionCooldown = module.interface.encodeFunctionData(
          'setQuestionCooldown',
          [40],
        )
        await avatar.exec(await module.getAddress(), 0, setQuestionCooldown)

        const setAnswerExpirationInvalid = module.interface.encodeFunctionData(
          'setAnswerExpiration',
          [99],
        )
        await expect(
          avatar.exec(await module.getAddress(), 0, setAnswerExpirationInvalid),
        ).to.be.revertedWith(
          'There need to be at least 60s between end of cooldown and expiration',
        )

        const setAnswerExpiration = module.interface.encodeFunctionData(
          'setAnswerExpiration',
          [100],
        )
        await avatar.exec(await module.getAddress(), 0, setAnswerExpiration)

        expect(await module.answerExpiration()).to.be.equals(100)
      })

      it('updates question cooldown', async () => {
        const { module, avatar } = await setupTestWithTestAvatar()

        expect(await module.answerExpiration()).to.be.equals(0)

        const calldata = module.interface.encodeFunctionData(
          'setAnswerExpiration',
          [511],
        )
        await avatar.exec(await module.getAddress(), 0, calldata)

        expect(await module.answerExpiration()).to.be.equals(511)
      })
    })

    describe('setArbitrator', async () => {
      it('throws if not authorized', async () => {
        const { module } = await setupTestWithTestAvatar()
        await expect(
          module.setArbitrator(ZeroAddress),
        ).to.be.revertedWithCustomError(module, 'OwnableUnauthorizedAccount')
      })

      it('updates arbitrator', async () => {
        const { module, oracle, avatar } = await setupTestWithTestAvatar()

        expect(await module.questionArbitrator()).to.be.equals(
          await oracle.getAddress(),
        )

        const calldata = module.interface.encodeFunctionData('setArbitrator', [
          ZeroAddress,
        ])
        await avatar.exec(await module.getAddress(), 0, calldata)

        expect(await module.questionArbitrator()).to.be.equals(ZeroAddress)
      })
    })

    describe('setMinimumBond', async () => {
      it('throws if not authorized', async () => {
        const { module } = await setupTestWithTestAvatar()
        await expect(module.setMinimumBond(2)).to.be.revertedWithCustomError(
          module,
          'OwnableUnauthorizedAccount',
        )
      })

      it('updates minimum bond', async () => {
        const { module, avatar } = await setupTestWithTestAvatar()

        expect(Number(await module.minimumBond())).to.be.equals(0)

        const calldata = module.interface.encodeFunctionData('setMinimumBond', [
          424242,
        ])
        await avatar.exec(await module.getAddress(), 0, calldata)

        expect(Number(await module.minimumBond())).to.be.equals(424242)
      })
    })

    describe('setTemplate', async () => {
      it('throws if not authorized', async () => {
        const { module } = await setupTestWithTestAvatar()
        await expect(module.setTemplate(2)).to.be.revertedWithCustomError(
          module,
          'OwnableUnauthorizedAccount',
        )
      })

      it('updates template', async () => {
        const { module, avatar } = await setupTestWithTestAvatar()

        expect(Number(await module.template())).to.be.equals(1337)

        const calldata = module.interface.encodeFunctionData('setTemplate', [
          112358,
        ])
        await avatar.exec(await module.getAddress(), 0, calldata)

        expect(Number(await module.template())).to.be.equals(112358)
      })
    })
  })
  describe('markProposalAsInvalidByHash', async () => {
    it('throws if not authorized', async () => {
      const { module } = await setupTestWithTestAvatar()
      const randomHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      await expect(
        module.markProposalAsInvalidByHash(randomHash),
      ).to.be.revertedWithCustomError(module, 'OwnableUnauthorizedAccount')
    })

    it('marks unknown question id as invalid', async () => {
      const { module, avatar } = await setupTestWithTestAvatar()

      const randomHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      expect(await module.questionIds(randomHash)).to.be.equals(ZERO_STATE)

      const calldata = module.interface.encodeFunctionData(
        'markProposalAsInvalidByHash',
        [randomHash],
      )
      await avatar.exec(await module.getAddress(), 0, calldata)

      expect(await module.questionIds(randomHash)).to.be.deep.equals(
        INVALIDATED_STATE,
      )
    })

    it('marks known question id as invalid', async () => {
      const { module, mock, oracle, avatar } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )

      await expect(module.addProposal(id, [txHash]))
        .to.emit(module, 'ProposalQuestionCreated')
        .withArgs(questionId, id)

      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        questionId,
      )

      const calldata = module.interface.encodeFunctionData(
        'markProposalAsInvalidByHash',
        [questionHash],
      )
      await avatar.exec(await module.getAddress(), 0, calldata)

      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        INVALIDATED_STATE,
      )
    })
  })

  describe('markProposalAsInvalid', async () => {
    it('throws if not authorized', async () => {
      const { module } = await setupTestWithTestAvatar()
      const randomHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      await expect(
        module.markProposalAsInvalid(randomHash, [randomHash]),
      ).to.be.revertedWithCustomError(module, 'OwnableUnauthorizedAccount')
    })

    it('marks unknown question id as invalid', async () => {
      const { module, avatar } = await setupTestWithTestAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      expect(await module.questionIds(questionHash)).to.be.equals(ZERO_STATE)

      const calldata = module.interface.encodeFunctionData(
        'markProposalAsInvalid',
        [id, [txHash]],
      )
      await avatar.exec(await module.getAddress(), 0, calldata)

      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        INVALIDATED_STATE,
      )
    })

    it('marks known question id as invalid', async () => {
      const { module, mock, oracle, avatar } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )

      await expect(module.addProposal(id, [txHash]))
        .to.emit(module, 'ProposalQuestionCreated')
        .withArgs(questionId, id)

      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        questionId,
      )

      const calldata = module.interface.encodeFunctionData(
        'markProposalAsInvalid',
        [id, [txHash]],
      )
      await avatar.exec(await module.getAddress(), 0, calldata)

      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        INVALIDATED_STATE,
      )
    })
  })

  describe('markProposalWithExpiredAnswerAsInvalid', async () => {
    it('throws if answer cannot expire', async () => {
      const { module } = await setupTestWithTestAvatar()

      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))

      await expect(
        module.markProposalWithExpiredAnswerAsInvalid(questionHash),
      ).to.be.revertedWith('Answers are valid forever')
    })

    it('throws if answer is already invalidated', async () => {
      const { module, avatar } = await setupTestWithTestAvatar()

      const setAnswerExpiration = module.interface.encodeFunctionData(
        'setAnswerExpiration',
        [90],
      )
      await avatar.exec(await module.getAddress(), 0, setAnswerExpiration)

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))

      const markProposalAsInvalidByHash = module.interface.encodeFunctionData(
        'markProposalAsInvalidByHash',
        [questionHash],
      )
      await avatar.exec(
        await module.getAddress(),
        0,
        markProposalAsInvalidByHash,
      )

      await expect(
        module.markProposalWithExpiredAnswerAsInvalid(questionHash),
      ).to.be.revertedWith('Proposal is already invalidated')
    })

    it('throws if question is unknown', async () => {
      const { module, avatar } = await setupTestWithTestAvatar()

      const setAnswerExpiration = module.interface.encodeFunctionData(
        'setAnswerExpiration',
        [90],
      )
      await avatar.exec(await module.getAddress(), 0, setAnswerExpiration)

      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))

      await expect(
        module.markProposalWithExpiredAnswerAsInvalid(questionHash),
      ).to.be.revertedWith('No question id set for provided proposal')
    })

    it('throws if answer was not accepted', async () => {
      const { mock, module, avatar, oracle } = await setupTestWithTestAvatar()

      const setAnswerExpiration = module.interface.encodeFunctionData(
        'setAnswerExpiration',
        [90],
      )
      await avatar.exec(await module.getAddress(), 0, setAnswerExpiration)

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))

      const block = await ethers.provider.getBlock('latest')
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('resultFor').selector,
        INVALIDATED_STATE,
      )
      await module.addProposal(id, [txHash])

      await expect(
        module.markProposalWithExpiredAnswerAsInvalid(questionHash),
      ).to.be.revertedWith('Only positive answers can expire')
    })

    it('throws if answer is not expired', async () => {
      const { mock, module, avatar, oracle } = await setupTestWithTestAvatar()

      const setAnswerExpiration = module.interface.encodeFunctionData(
        'setAnswerExpiration',
        [90],
      )
      await avatar.exec(await module.getAddress(), 0, setAnswerExpiration)

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))

      const block = await ethers.provider.getBlock('latest')
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      await module.addProposal(id, [txHash])

      await expect(
        module.markProposalWithExpiredAnswerAsInvalid(questionHash),
      ).to.be.revertedWith('Answer has not expired yet')
    })

    it('can mark proposal with expired accepted answer as invalid', async () => {
      const { mock, module, avatar, oracle } = await setupTestWithTestAvatar()

      const setAnswerExpiration = module.interface.encodeFunctionData(
        'setAnswerExpiration',
        [90],
      )
      await avatar.exec(await module.getAddress(), 0, setAnswerExpiration)

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))

      const block = await ethers.provider.getBlock('latest')
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      await module.addProposal(id, [txHash])

      await nextBlockTime(hre, block.timestamp + 91)

      await module.markProposalWithExpiredAnswerAsInvalid(questionHash)
      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        INVALIDATED_STATE,
      )
    })
  })

  describe('getTransactionHash', async () => {
    it('correctly generates hash for tx without data', async () => {
      const { module } = await setupTestWithTestAvatar()
      const chainId = await module.getChainId()
      const domain = {
        chainId: chainId,
        verifyingContract: await module.getAddress(),
      }
      const tx = {
        to: user1.address,
        value: 0,
        data: '0x',
        operation: 0,
        nonce: 0,
      }
      expect(
        await module.getTransactionHash(
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
          tx.nonce,
        ),
      ).to.be.equals(_TypedDataEncoder.hash(domain, EIP712_TYPES, tx))
    })

    it('correctly generates hash for complex tx', async () => {
      const { module } = await setupTestWithTestAvatar()
      const chainId = await module.getChainId()
      const domain = {
        chainId: chainId,
        verifyingContract: await module.getAddress(),
      }
      const tx = {
        to: user1.address,
        value: 23,
        data: '0xbaddad',
        operation: 1,
        nonce: 13,
      }
      expect(
        await module.getTransactionHash(
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
          tx.nonce,
        ),
      ).to.be.equals(_TypedDataEncoder.hash(domain, EIP712_TYPES, tx))
    })
  })

  describe('buildQuestion', async () => {
    it('concatenats id and hashed hashes as ascii strings', async () => {
      const { module } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const tx1Hash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      const tx2Hash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_other_tx_data'],
      )
      const hashesHash = ethers
        .solidityPackedKeccak256(['bytes32[]'], [[tx1Hash, tx2Hash]])
        .slice(2)
      expect(await module.buildQuestion(id, [tx1Hash, tx2Hash])).to.be.equals(
        `${id}␟${hashesHash}`,
      )
    })
  })

  describe('addProposal', async () => {
    it('throws if unexpected question id is returned', async () => {
      const { module, mock, oracle } = await setupTestWithTestAvatar()
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        42,
      )
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      await expect(module.addProposal(id, [txHash])).to.be.revertedWith(
        'Unexpected question id',
      )
    })

    it('throws if proposed question was already invalidated before creation', async () => {
      const { module, mock, oracle, avatar } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )

      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )

      const markInvalid = module.interface.encodeFunctionData(
        'markProposalAsInvalid',
        [id, [txHash]],
      )
      await avatar.exec(await module.getAddress(), 0, markInvalid)

      await expect(module.addProposal(id, [txHash])).to.be.revertedWith(
        'Proposal has already been submitted',
      )
    })

    it('throws if proposal was already submitted', async () => {
      const { module, mock, oracle, avatar } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )

      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )

      await module.addProposal(id, [txHash])

      await expect(module.addProposal(id, [txHash])).to.be.revertedWith(
        'Proposal has already been submitted',
      )
    })

    it('throws if proposal was already submitted when question params were different', async () => {
      const { module, mock, oracle, avatar } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )

      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )

      await module.addProposal(id, [txHash])

      const updateQuestionTimeout = module.interface.encodeFunctionData(
        'setQuestionTimeout',
        [31],
      )
      await avatar.exec(await module.getAddress(), 0, updateQuestionTimeout)

      await expect(module.addProposal(id, [txHash])).to.be.revertedWith(
        'Proposal has already been submitted',
      )
    })

    it('calls askQuestionWithMinBond with correct data', async () => {
      const { module, mock, oracle } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )

      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )

      await expect(module.addProposal(id, [txHash]))
        .to.emit(module, 'ProposalQuestionCreated')
        .withArgs(questionId, id)

      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        questionId,
      )

      const askQuestionCalldata = oracle.interface.encodeFunctionData(
        'askQuestionWithMinBond',
        [1337, question, await oracle.getAddress(), 42, 0, 0, 0],
      )
      expect(
        Number(
          await mock.invocationCountForCalldata.staticCall(askQuestionCalldata),
        ),
      ).to.be.equals(1)
      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(1)
    })
  })

  it('calls askQuestionWithMinBond with correct data when minimum bond is set', async () => {
    const { module, mock, oracle, avatar } = await setupTestWithTestAvatar()
    const id = 'some_random_id'
    const txHash = ethers.solidityPackedKeccak256(['string'], ['some_tx_data'])

    const setMinimumBond = module.interface.encodeFunctionData(
      'setMinimumBond',
      [7331],
    )
    await avatar.exec(await module.getAddress(), 0, setMinimumBond)

    const question = await module.buildQuestion(id, [txHash])
    const questionId = await module.getQuestionId(question, 0)
    const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
    await mock.givenMethodReturnUint(
      oracle.interface.getFunction('askQuestionWithMinBond').selector,
      questionId,
    )

    await expect(module.addProposal(id, [txHash]))
      .to.emit(module, 'ProposalQuestionCreated')
      .withArgs(questionId, id)

    expect(await module.questionIds(questionHash)).to.be.deep.equals(questionId)

    const askQuestionCalldata = oracle.interface.encodeFunctionData(
      'askQuestionWithMinBond',
      [1337, question, await mock.getAddress(), 42, 0, 0, 7331],
    )
    expect(
      Number(
        await mock.invocationCountForCalldata.staticCall(askQuestionCalldata),
      ),
    ).to.be.equals(1)
    expect(Number(await mock.invocationCount.staticCall())).to.be.equals(1)
  })

  describe('addProposalWithNonce', async () => {
    it('throws if previous nonce was not invalid', async () => {
      const { module, mock, oracle } = await setupTestWithTestAvatar()
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        42,
      )
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )
      const question = await module.buildQuestion(id, [txHash])
      const previousQuestionId = await module.getQuestionId(question, 0)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        previousQuestionId,
      )
      await module.addProposal(id, [txHash])

      await expect(
        module.addProposalWithNonce(id, [txHash], 1),
      ).to.be.revertedWith('Previous proposal was not invalidated')
    })

    it('calls askQuestionWithMinBond with correct data', async () => {
      const { module, mock, oracle } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )

      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 1)
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      const previousQuestionId = await module.getQuestionId(question, 0)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        previousQuestionId,
      )
      await module.addProposal(id, [txHash])

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      const resultForCalldata = oracle.interface.encodeFunctionData(
        'resultFor',
        [previousQuestionId],
      )
      await mock.givenCalldataReturnUint(resultForCalldata, INVALIDATED_STATE)

      await expect(module.addProposalWithNonce(id, [txHash], 1))
        .to.emit(module, 'ProposalQuestionCreated')
        .withArgs(questionId, id)

      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        questionId,
      )

      const askQuestionCalldata = oracle.interface.encodeFunctionData(
        'askQuestionWithMinBond',
        [1337, question, await mock.getAddress(), 42, 0, 1, 0],
      )
      expect(
        Number(
          await mock.invocationCountForCalldata.staticCall(askQuestionCalldata),
        ),
      ).to.be.equals(1)

      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(2)
    })

    it('can invalidate after question param change', async () => {
      const { module, mock, oracle, avatar } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )

      const question = await module.buildQuestion(id, [txHash])
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      const previousQuestionId = await module.getQuestionId(question, 0)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        previousQuestionId,
      )
      await module.addProposal(id, [txHash])

      const updateQuestionTimeout = module.interface.encodeFunctionData(
        'setQuestionTimeout',
        [23],
      )
      await avatar.exec(await module.getAddress(), 0, updateQuestionTimeout)

      const questionId = await module.getQuestionId(question, 11)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await mock.givenCalldataReturnUint(
        oracle.interface.encodeFunctionData('resultFor', [previousQuestionId]),
        INVALIDATED_STATE,
      )

      await expect(module.addProposalWithNonce(id, [txHash], 11))
        .to.emit(module, 'ProposalQuestionCreated')
        .withArgs(questionId, id)
      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        questionId,
      )

      const askQuestionCalldata = oracle.interface.encodeFunctionData(
        'askQuestionWithMinBond',
        [1337, question, await mock.getAddress(), 23, 0, 11, 0],
      )
      expect(
        Number(
          await mock.invocationCountForCalldata.staticCall(askQuestionCalldata),
        ),
      ).to.be.equals(1)

      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(2)
    })

    it('can invalidate multiple times', async () => {
      const { module, mock, oracle } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )

      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 1)
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      const previousQuestionId = await module.getQuestionId(question, 0)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        previousQuestionId,
      )
      await module.addProposal(id, [txHash])

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await mock.givenCalldataReturnUint(
        oracle.interface.encodeFunctionData('resultFor', [previousQuestionId]),
        INVALIDATED_STATE,
      )

      await expect(module.addProposalWithNonce(id, [txHash], 1))
        .to.emit(module, 'ProposalQuestionCreated')
        .withArgs(questionId, id)
      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        questionId,
      )

      // Nonce doesn't need to increase 1 by 1
      const finalQuestionId = await module.getQuestionId(question, 1337)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        finalQuestionId,
      )
      await mock.givenCalldataReturnUint(
        oracle.interface.encodeFunctionData('resultFor', [questionId]),
        INVALIDATED_STATE,
      )

      await expect(module.addProposalWithNonce(id, [txHash], 1337))
        .to.emit(module, 'ProposalQuestionCreated')
        .withArgs(finalQuestionId, id)
      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        finalQuestionId,
      )

      const askQuestionCalldata = oracle.interface.encodeFunctionData(
        'askQuestionWithMinBond',
        [1337, question, await mock.getAddress(), 42, 0, 1337, 0],
      )
      expect(
        Number(
          await mock.invocationCountForCalldata.staticCall(askQuestionCalldata),
        ),
      ).to.be.equals(1)

      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(3)
    })

    it('does not create proposal if previous nonce was internally invalidated', async () => {
      const { module, mock, oracle, avatar } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )

      const question = await module.buildQuestion(id, [txHash])
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      const questionIdNonce0 = await module.getQuestionId(question, 0)
      const questionIdNonce1 = await module.getQuestionId(question, 1)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionIdNonce0,
      )
      const proposalParameters = [id, [txHash]]
      await module.addProposal(...proposalParameters)

      const markAsInvalidCalldata = module.interface.encodeFunctionData(
        'markProposalAsInvalid',
        [...proposalParameters],
      )
      await avatar.exec(await module.getAddress(), 0, markAsInvalidCalldata)
      expect(await module.questionIds(questionHash)).to.deep.equal(
        INVALIDATED_STATE,
      )

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('resultFor').selector,
        INVALIDATED_STATE,
      )

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionIdNonce1,
      )
      await expect(
        module.addProposalWithNonce(...proposalParameters, 1),
      ).to.be.revertedWith('This proposal has been marked as invalid')
    })

    it('cannot ask again if follop up was not invalidated', async () => {
      const { module, mock, oracle, avatar } = await setupTestWithTestAvatar()
      const id = 'some_random_id'
      const txHash = ethers.solidityPackedKeccak256(
        ['string'],
        ['some_tx_data'],
      )

      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 42)
      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      const previousQuestionId = await module.getQuestionId(question, 0)
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        previousQuestionId,
      )
      await module.addProposal(id, [txHash])

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await mock.givenCalldataReturnUint(
        oracle.interface.encodeFunctionData('resultFor', [previousQuestionId]),
        INVALIDATED_STATE,
      )

      await expect(module.addProposalWithNonce(id, [txHash], 42))
        .to.emit(module, 'ProposalQuestionCreated')
        .withArgs(questionId, id)
      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        questionId,
      )

      await mock.givenCalldataReturnBool(
        oracle.interface.encodeFunctionData('resultFor', [questionId]),
        true,
      )

      await expect(
        module.addProposalWithNonce(id, [txHash], 1337),
      ).to.be.revertedWith('Previous proposal was not invalidated')
    })
  })

  describe('executeProposal', async () => {
    it('throws if question id was not set', async () => {
      const { module } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )

      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('No question id set for provided proposal')
    })

    it('throws if proposal has been invalidated', async () => {
      const { avatar, mock, module, oracle } = await setupTestWithTestAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])

      const markInvalid = module.interface.encodeFunctionData(
        'markProposalAsInvalid',
        [id, [txHash]],
      )
      await avatar.exec(await module.getAddress(), 0, markInvalid)

      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Proposal has been invalidated')
    })

    it('Proposal stays invalid after question param updates', async () => {
      const { avatar, mock, module, oracle } = await setupTestWithTestAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])

      const markInvalid = module.interface.encodeFunctionData(
        'markProposalAsInvalid',
        [id, [txHash]],
      )
      await avatar.exec(await module.getAddress(), 0, markInvalid)

      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Proposal has been invalidated')

      const updateQuestionTimeout = module.interface.encodeFunctionData(
        'setQuestionTimeout',
        [31],
      )
      await avatar.exec(await module.getAddress(), 0, updateQuestionTimeout)

      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Proposal has been invalidated')
    })

    it("throws if tx data doesn't belong to proposal", async () => {
      const { mock, module, oracle } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 1,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])

      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Unexpected transaction hash')
    })

    it("throws if tx data doesn't belong to questionId", async () => {
      const { mock, module, oracle } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [])

      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )

      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('No question id set for provided proposal')
    })

    it('throws if tx was not approved', async () => {
      const { mock, module, oracle } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])

      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        false,
      )

      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Transaction was not approved')
    })

    it('throws if bond was not high enough', async () => {
      const { avatar, mock, module, oracle } = await setupTestWithTestAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])

      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )

      const setMinimumBond = module.interface.encodeFunctionData(
        'setMinimumBond',
        [7331],
      )
      await avatar.exec(await module.getAddress(), 0, setMinimumBond)

      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Bond on question not high enough')
    })

    it('triggers module transaction when bond is high enough', async () => {
      const { avatar, mock, module, oracle } = await setupTestWithTestAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])

      const setMinimumBond = module.interface.encodeFunctionData(
        'setMinimumBond',
        [7331],
      )
      await avatar.exec(await module.getAddress(), 0, setMinimumBond)
      await avatar.setModule(await module.getAddress())

      const block = await ethers.provider.getBlock('latest')
      await mock.reset()
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getBond').selector,
        7331,
      )
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )

      await nextBlockTime(hre, block.timestamp + 24)
      await module.executeProposal(
        id,
        [txHash],
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
      )

      expect(
        await module.executedProposalTransactions(
          ethers.solidityPackedKeccak256(['string'], [question]),
          txHash,
        ),
      ).to.be.equals(true)
    })

    it('throws if cooldown was not over', async () => {
      const { mock, module, oracle } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])

      const block = await ethers.provider.getBlock('latest')
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )

      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Wait for additional cooldown')
    })

    it('throws if answer expired', async () => {
      const { mock, module, oracle, avatar } = await setupTestWithTestAvatar()

      await user1.sendTransaction({ to: await avatar.getAddress(), value: 100 })
      await avatar.setModule(await module.getAddress())
      const setAnswerExpiration = module.interface.encodeFunctionData(
        'setAnswerExpiration',
        [90],
      )
      await avatar.exec(await module.getAddress(), 0, setAnswerExpiration)

      const id = 'some_random_id'
      const tx = {
        to: await mock.getAddress(),
        value: 42,
        data: '0x',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])
      const block = await ethers.provider.getBlock('latest')
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )
      await mock.givenMethodReturnBool(
        avatar.interface.getFunction('execTransactionFromModule').selector,
        true,
      )
      await nextBlockTime(hre, block.timestamp + 91)
      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Answer has expired')

      // Reset answer expiration time, so that we can execute the transaction
      const resetAnswerExpiration = module.interface.encodeFunctionData(
        'setAnswerExpiration',
        [0],
      )
      await avatar.exec(await module.getAddress(), 0, resetAnswerExpiration)

      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(1)
      expect(
        Number(await hre.ethers.provider.getBalance(await mock.getAddress())),
      ).to.be.equals(0)

      await module.executeProposal(
        id,
        [txHash],
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
      )

      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(2)
      expect(
        Number(await hre.ethers.provider.getBalance(await mock.getAddress())),
      ).to.be.equals(42)
    })

    it('throws if tx was already executed for that question', async () => {
      const { mock, module, oracle, avatar } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])
      const block = await ethers.provider.getBlock('latest')
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )
      await mock.givenMethodReturnBool(
        avatar.interface.getFunction('execTransactionFromModule').selector,
        true,
      )
      await nextBlockTime(hre, block.timestamp + 24)
      await module.executeProposal(
        id,
        [txHash],
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
      )
      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Cannot execute transaction again')
    })

    it('throws if module transaction failed', async () => {
      const { avatar, mock, module, oracle } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx = {
        to: await mock.getAddress(),
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])
      const block = await ethers.provider.getBlock('latest')
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )
      await mock.givenMethodReturnBool(
        avatar.interface.getFunction('execTransactionFromModule').selector,
        false,
      )
      await nextBlockTime(hre, block.timestamp + 24)
      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(1)
      await expect(
        module.executeProposalWithIndex(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
          tx.nonce,
        ),
      ).to.be.revertedWith('Module transaction failed')
      expect(
        await module.executedProposalTransactions(
          ethers.solidityPackedKeccak256(['string'], [question]),
          txHash,
        ),
      ).to.be.equals(false)

      // Return success and check that it can be executed
      await mock.givenMethodReturnBool(
        avatar.interface.getFunction('execTransactionFromModule').selector,
        true,
      )
      await module.executeProposalWithIndex(
        id,
        [txHash],
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      expect(
        await module.executedProposalTransactions(
          ethers.solidityPackedKeccak256(['string'], [question]),
          txHash,
        ),
      ).to.be.equals(true)
    })

    it('triggers module transaction', async () => {
      const { avatar, mock, module, oracle } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const txHash = await module.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.nonce,
      )
      const question = await module.buildQuestion(id, [txHash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [txHash])

      const block = await ethers.provider.getBlock('latest')
      await mock.reset()
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )
      await mock.givenMethodReturnBool(
        avatar.interface.getFunction('execTransactionFromModule').selector,
        true,
      )
      await nextBlockTime(hre, block.timestamp + 23)
      await expect(
        module.executeProposal(
          id,
          [txHash],
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ),
      ).to.be.revertedWith('Wait for additional cooldown')

      await nextBlockTime(hre, block.timestamp + 24)
      await module.executeProposal(
        id,
        [txHash],
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
      )

      const questionHash = ethers.keccak256(ethers.toUtf8Bytes(question))
      expect(await module.questionIds(questionHash)).to.be.deep.equals(
        questionId,
      )
      expect(
        await module.executedProposalTransactions(
          ethers.solidityPackedKeccak256(['string'], [question]),
          txHash,
        ),
      ).to.be.equals(true)

      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(1)
      const execTransactionFromModuleCalldata =
        avatar.interface.encodeFunctionData('execTransactionFromModule', [
          tx.to,
          tx.value,
          tx.data,
          tx.operation,
        ])
      expect(
        Number(
          await mock.invocationCountForCalldata.staticCall(
            execTransactionFromModuleCalldata,
          ),
        ),
      ).to.be.equals(1)
    })

    it('throws if previous tx in tx array was not executed yet', async () => {
      const { mock, module, oracle } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx1 = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const tx1Hash = await module.getTransactionHash(
        tx1.to,
        tx1.value,
        tx1.data,
        tx1.operation,
        tx1.nonce,
      )
      const tx2 = {
        to: user1.address,
        value: 23,
        data: '0xdeaddeed',
        operation: 0,
        nonce: 1,
      }
      const tx2Hash = await module.getTransactionHash(
        tx2.to,
        tx2.value,
        tx2.data,
        tx2.operation,
        tx2.nonce,
      )
      const question = await module.buildQuestion(id, [tx1Hash, tx2Hash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [tx1Hash, tx2Hash])
      const block = await ethers.provider.getBlock('latest')
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )
      await nextBlockTime(hre, block.timestamp + 24)
      await expect(
        module.executeProposalWithIndex(
          id,
          [tx1Hash, tx2Hash],
          tx2.to,
          tx2.value,
          tx2.data,
          tx2.operation,
          tx2.nonce,
        ),
      ).to.be.revertedWith('Previous transaction not executed yet')
    })

    it('allows to execute the transactions in different blocks', async () => {
      const { avatar, mock, module, oracle } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx1 = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const tx1Hash = await module.getTransactionHash(
        tx1.to,
        tx1.value,
        tx1.data,
        tx1.operation,
        tx1.nonce,
      )
      const tx2 = {
        to: user1.address,
        value: 23,
        data: '0xdeaddeed',
        operation: 0,
        nonce: 1,
      }
      const tx2Hash = await module.getTransactionHash(
        tx2.to,
        tx2.value,
        tx2.data,
        tx2.operation,
        tx2.nonce,
      )
      const question = await module.buildQuestion(id, [tx1Hash, tx2Hash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [tx1Hash, tx2Hash])
      const block = await ethers.provider.getBlock('latest')
      await mock.reset()
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )
      await mock.givenMethodReturnBool(
        avatar.interface.getFunction('execTransactionFromModule').selector,
        true,
      )
      await nextBlockTime(hre, block.timestamp + 24)

      await module.executeProposal(
        id,
        [tx1Hash, tx2Hash],
        tx1.to,
        tx1.value,
        tx1.data,
        tx1.operation,
      )

      expect(
        await module.executedProposalTransactions(
          ethers.solidityPackedKeccak256(['string'], [question]),
          tx1Hash,
        ),
      ).to.be.equals(true)

      const execTransaction1FromModuleCalldata =
        avatar.interface.encodeFunctionData('execTransactionFromModule', [
          tx1.to,
          tx1.value,
          tx1.data,
          tx1.operation,
        ])
      expect(
        Number(
          await mock.invocationCountForCalldata.staticCall(
            execTransaction1FromModuleCalldata,
          ),
        ),
      ).to.be.equals(1)

      await module.executeProposalWithIndex(
        id,
        [tx1Hash, tx2Hash],
        tx2.to,
        tx2.value,
        tx2.data,
        tx2.operation,
        tx2.nonce,
      )

      expect(
        await module.executedProposalTransactions(
          ethers.solidityPackedKeccak256(['string'], [question]),
          tx2Hash,
        ),
      ).to.be.equals(true)
      const execTransaction2FromModuleCalldata =
        avatar.interface.encodeFunctionData('execTransactionFromModule', [
          tx2.to,
          tx2.value,
          tx2.data,
          tx2.operation,
        ])
      expect(
        Number(
          await mock.invocationCountForCalldata.staticCall(
            execTransaction2FromModuleCalldata,
          ),
        ),
      ).to.be.equals(1)

      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(2)
    })

    it('allows to send same tx (with different nonce) multiple times in proposal', async () => {
      const { avatar, mock, module, oracle } = await setupTestWithMockAvatar()

      const id = 'some_random_id'
      const tx1 = {
        to: user1.address,
        value: 0,
        data: '0xbaddad',
        operation: 0,
        nonce: 0,
      }
      const tx1Hash = await module.getTransactionHash(
        tx1.to,
        tx1.value,
        tx1.data,
        tx1.operation,
        tx1.nonce,
      )
      const tx2 = { ...tx1, nonce: 1 }
      const tx2Hash = await module.getTransactionHash(
        tx2.to,
        tx2.value,
        tx2.data,
        tx2.operation,
        tx2.nonce,
      )
      expect(tx1Hash).to.be.not.equals(tx2Hash)

      const question = await module.buildQuestion(id, [tx1Hash, tx2Hash])
      const questionId = await module.getQuestionId(question, 0)

      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('askQuestionWithMinBond').selector,
        questionId,
      )
      await module.addProposal(id, [tx1Hash, tx2Hash])
      const block = await ethers.provider.getBlock('latest')
      await mock.reset()
      await mock.givenMethodReturnBool(
        oracle.interface.getFunction('resultFor').selector,
        true,
      )
      if (!block) return
      await mock.givenMethodReturnUint(
        oracle.interface.getFunction('getFinalizeTS').selector,
        block.timestamp,
      )
      await mock.givenMethodReturnBool(
        avatar.interface.getFunction('execTransactionFromModule').selector,
        true,
      )
      await nextBlockTime(hre, block.timestamp + 24)

      await module.executeProposal(
        id,
        [tx1Hash, tx2Hash],
        tx1.to,
        tx1.value,
        tx1.data,
        tx1.operation,
      )

      expect(
        await module.executedProposalTransactions(
          ethers.solidityPackedKeccak256(['string'], [question]),
          tx1Hash,
        ),
      ).to.be.equals(true)

      const execTransactionFromModuleCalldata =
        avatar.interface.encodeFunctionData('execTransactionFromModule', [
          tx1.to,
          tx1.value,
          tx1.data,
          tx1.operation,
        ])
      expect(
        Number(
          await mock.invocationCountForCalldata.staticCall(
            execTransactionFromModuleCalldata,
          ),
        ),
      ).to.be.equals(1)

      await module.executeProposalWithIndex(
        id,
        [tx1Hash, tx2Hash],
        tx2.to,
        tx2.value,
        tx2.data,
        tx2.operation,
        tx2.nonce,
      )

      expect(
        await module.executedProposalTransactions(
          ethers.solidityPackedKeccak256(['string'], [question]),
          tx2Hash,
        ),
      ).to.be.equals(true)
      expect(
        Number(
          await mock.invocationCountForCalldata.staticCall(
            execTransactionFromModuleCalldata,
          ),
        ),
      ).to.be.equals(2)

      expect(Number(await mock.invocationCount.staticCall())).to.be.equals(2)
    })
  })
})
