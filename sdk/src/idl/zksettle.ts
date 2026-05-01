/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `sdk/src/idl/zksettle.json`.
 */
export type Zksettle = {
  "address": "AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo",
  "metadata": {
    "name": "zksettle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "ZKSettle thin-slice verifier"
  },
  "instructions": [
    {
      "name": "checkAttestation",
      "discriminator": [
        60,
        141,
        192,
        150,
        177,
        205,
        44,
        208
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "issuer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "issuer.authority",
                "account": "issuer"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "nullifierHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "validityProof",
          "type": {
            "defined": {
              "name": "validityProof"
            }
          }
        },
        {
          "name": "attestationMeta",
          "type": {
            "defined": {
              "name": "compressedAccountMetaReadOnly"
            }
          }
        },
        {
          "name": "compressedAttestation",
          "type": {
            "defined": {
              "name": "compressedAttestation"
            }
          }
        }
      ]
    },
    {
      "name": "closeHookPayload",
      "discriminator": [
        53,
        220,
        226,
        75,
        158,
        12,
        231,
        141
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "hookPayload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  111,
                  107,
                  45,
                  112,
                  97,
                  121,
                  108,
                  111,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initAttestationTree",
      "discriminator": [
        122,
        232,
        208,
        57,
        120,
        193,
        9,
        19
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "issuer"
          ]
        },
        {
          "name": "issuer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  98,
                  98,
                  108,
                  101,
                  103,
                  117,
                  109,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "merkleTree",
          "writable": true,
          "signer": true
        },
        {
          "name": "treeConfig",
          "writable": true
        },
        {
          "name": "treeCreator",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  98,
                  98,
                  108,
                  101,
                  103,
                  117,
                  109,
                  45,
                  116,
                  114,
                  101,
                  101,
                  45,
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "bubblegumProgram",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "compressionProgram",
          "address": "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
        },
        {
          "name": "logWrapper",
          "address": "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initExtraAccountMetaList",
      "discriminator": [
        16,
        12,
        254,
        251,
        252,
        103,
        115,
        58
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "issuer"
          ]
        },
        {
          "name": "issuer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "unpacks as Token-2022 Mint and asserts the TransferHook extension points to",
            "this program. Kept as UncheckedAccount to avoid Anchor Mint deser overhead",
            "on a one-time setup instruction."
          ]
        },
        {
          "name": "extraAccountMetaList",
          "docs": [
            "and `ExtraAccountMetaList::init`. PDA seed matches the SPL transfer-hook",
            "interface convention so Token-2022 can resolve it."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "extras",
          "type": {
            "vec": {
              "defined": {
                "name": "extraAccountMetaInput"
              }
            }
          }
        }
      ]
    },
    {
      "name": "registerIssuer",
      "discriminator": [
        145,
        117,
        52,
        59,
        189,
        27,
        127,
        18
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "issuer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "merkleRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "sanctionsRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "jurisdictionRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "setHookPayload",
      "discriminator": [
        139,
        145,
        21,
        87,
        155,
        138,
        100,
        137
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "issuer"
          ]
        },
        {
          "name": "issuer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "hookPayload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  111,
                  107,
                  45,
                  112,
                  97,
                  121,
                  108,
                  111,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "proofAndWitness",
          "type": "bytes"
        },
        {
          "name": "nullifierHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "mint",
          "type": "pubkey"
        },
        {
          "name": "epoch",
          "type": "u64"
        },
        {
          "name": "recipient",
          "type": "pubkey"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "lightArgs",
          "type": {
            "defined": {
              "name": "stagedLightArgs"
            }
          }
        }
      ]
    },
    {
      "name": "settleHook",
      "docs": [
        "Direct-call settlement. Issuer authority signs and receives rent refund",
        "from the closed payload. Not invoked by Token-2022."
      ],
      "discriminator": [
        188,
        162,
        182,
        6,
        30,
        19,
        21,
        139
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "destinationToken",
          "docs": [
            "UncheckedAccount because in the direct-call path `recipient` may be a",
            "wallet address (matching `leaf_owner`) rather than a token account."
          ]
        },
        {
          "name": "hookPayload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  111,
                  107,
                  45,
                  112,
                  97,
                  121,
                  108,
                  111,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "leafOwner"
        },
        {
          "name": "issuer"
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  98,
                  98,
                  108,
                  101,
                  103,
                  117,
                  109,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "merkleTree",
          "writable": true
        },
        {
          "name": "treeConfig",
          "writable": true
        },
        {
          "name": "treeCreator",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  98,
                  98,
                  108,
                  101,
                  103,
                  117,
                  109,
                  45,
                  116,
                  114,
                  101,
                  101,
                  45,
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "bubblegumProgram",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "compressionProgram",
          "address": "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
        },
        {
          "name": "logWrapper",
          "address": "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "transferHook",
      "docs": [
        "Token-2022 transfer-hook `Execute` entry. Discriminator matches",
        "`sha256(\"spl-transfer-hook-interface:execute\")[..8]` — value taken from",
        "`spl_transfer_hook_interface::instruction::ExecuteInstruction::SPL_DISCRIMINATOR`.",
        "",
        "Replay barrier: Light compressed-address collision on",
        "`[NULLIFIER_SEED, issuer, nullifier_hash]` (ADR-007 + ADR-020). The",
        "payload PDA is NOT closed here — SPL passes `owner` as read-only",
        "(`AccountMeta::new_readonly`), blocking `close = owner`. Authority",
        "calls `close_hook_payload` after the transfer to reclaim rent and",
        "unblock the next `set_hook_payload`."
      ],
      "discriminator": [
        105,
        37,
        101,
        197,
        75,
        251,
        102,
        26
      ],
      "accounts": [
        {
          "name": "sourceToken"
        },
        {
          "name": "mint"
        },
        {
          "name": "destinationToken"
        },
        {
          "name": "owner",
          "docs": [
            "`hook_payload` via PDA seed."
          ]
        },
        {
          "name": "extraAccountMetaList",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "hookPayload",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  111,
                  107,
                  45,
                  112,
                  97,
                  121,
                  108,
                  111,
                  97,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "issuer"
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  98,
                  98,
                  108,
                  101,
                  103,
                  117,
                  109,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "bubblegumProgram",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateIssuerRoot",
      "discriminator": [
        145,
        255,
        165,
        254,
        96,
        129,
        245,
        249
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "issuer"
          ]
        },
        {
          "name": "issuer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "merkleRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "sanctionsRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "jurisdictionRoot",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "verifyProof",
      "discriminator": [
        217,
        211,
        191,
        110,
        144,
        13,
        186,
        98
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "issuer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  115,
                  115,
                  117,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "issuer.authority",
                "account": "issuer"
              }
            ]
          }
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  98,
                  98,
                  108,
                  101,
                  103,
                  117,
                  109,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "leafOwner"
        },
        {
          "name": "merkleTree",
          "writable": true
        },
        {
          "name": "treeConfig",
          "writable": true
        },
        {
          "name": "treeCreator",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  98,
                  98,
                  108,
                  101,
                  103,
                  117,
                  109,
                  45,
                  116,
                  114,
                  101,
                  101,
                  45,
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "bubblegumProgram",
          "address": "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
        },
        {
          "name": "compressionProgram",
          "address": "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
        },
        {
          "name": "logWrapper",
          "address": "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "proofAndWitness",
          "type": "bytes"
        },
        {
          "name": "nullifierHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "mint",
          "type": "pubkey"
        },
        {
          "name": "epoch",
          "type": "u64"
        },
        {
          "name": "recipient",
          "type": "pubkey"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "validityProof",
          "type": {
            "defined": {
              "name": "validityProof"
            }
          }
        },
        {
          "name": "addressTreeInfo",
          "type": {
            "defined": {
              "name": "packedAddressTreeInfo"
            }
          }
        },
        {
          "name": "outputStateTreeIndex",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bubblegumTreeRegistry",
      "discriminator": [
        221,
        135,
        203,
        66,
        156,
        191,
        157,
        71
      ]
    },
    {
      "name": "hookPayload",
      "discriminator": [
        121,
        171,
        24,
        111,
        118,
        53,
        110,
        99
      ]
    },
    {
      "name": "issuer",
      "discriminator": [
        216,
        19,
        83,
        230,
        108,
        53,
        80,
        14
      ]
    }
  ],
  "events": [
    {
      "name": "attestationChecked",
      "discriminator": [
        26,
        167,
        242,
        7,
        86,
        79,
        184,
        184
      ]
    },
    {
      "name": "proofSettled",
      "discriminator": [
        108,
        6,
        201,
        20,
        0,
        169,
        42,
        135
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "malformedProof",
      "msg": "Proof or witness bytes are malformed"
    },
    {
      "code": 6001,
      "name": "proofInvalid",
      "msg": "Proof verification failed"
    },
    {
      "code": 6002,
      "name": "zeroMerkleRoot",
      "msg": "Merkle root must be non-zero"
    },
    {
      "code": 6003,
      "name": "unauthorizedIssuer",
      "msg": "Signer is not the issuer authority"
    },
    {
      "code": 6004,
      "name": "merkleRootMismatch",
      "msg": "Witness merkle_root does not match issuer PDA"
    },
    {
      "code": 6005,
      "name": "nullifierMismatch",
      "msg": "Witness nullifier does not match instruction argument"
    },
    {
      "code": 6006,
      "name": "witnessTooShort",
      "msg": "Witness has fewer public inputs than required"
    },
    {
      "code": 6007,
      "name": "rootStale",
      "msg": "Issuer merkle root is stale; re-publish before verifying"
    },
    {
      "code": 6008,
      "name": "zeroNullifier",
      "msg": "Nullifier hash must be non-zero"
    },
    {
      "code": 6009,
      "name": "mintMismatch",
      "msg": "Witness mint limbs do not match instruction argument"
    },
    {
      "code": 6010,
      "name": "epochMismatch",
      "msg": "Witness epoch does not match instruction argument"
    },
    {
      "code": 6011,
      "name": "recipientMismatch",
      "msg": "Witness recipient limbs do not match instruction argument"
    },
    {
      "code": 6012,
      "name": "amountMismatch",
      "msg": "Witness amount does not match instruction argument"
    },
    {
      "code": 6013,
      "name": "epochInFuture",
      "msg": "Proof epoch is in the future relative to on-chain clock"
    },
    {
      "code": 6014,
      "name": "epochStale",
      "msg": "Proof epoch is older than allowed freshness window"
    },
    {
      "code": 6015,
      "name": "attestationExpired",
      "msg": "Attestation has expired beyond the validity window"
    },
    {
      "code": 6016,
      "name": "negativeClock",
      "msg": "On-chain clock returned a negative unix timestamp"
    },
    {
      "code": 6017,
      "name": "lightTreeLookupFailed",
      "msg": "Light Protocol tree pubkey lookup failed"
    },
    {
      "code": 6018,
      "name": "lightAccountPackFailed",
      "msg": "Packing a compressed account for Light CPI failed"
    },
    {
      "code": 6019,
      "name": "lightInvokeFailed",
      "msg": "Light Protocol CPI invoke failed"
    },
    {
      "code": 6020,
      "name": "invalidLightAddress",
      "msg": "Compressed account address is invalid"
    },
    {
      "code": 6021,
      "name": "hookPayloadInvalid",
      "msg": "Hook payload is malformed or too large"
    },
    {
      "code": 6022,
      "name": "invalidTransferAmount",
      "msg": "Transfer amount must be non-zero"
    },
    {
      "code": 6023,
      "name": "issuerMismatch",
      "msg": "Hook payload issuer does not match issuer account"
    },
    {
      "code": 6024,
      "name": "notToken2022",
      "msg": "Source token account is not owned by Token-2022"
    },
    {
      "code": 6025,
      "name": "notInTransfer",
      "msg": "Transfer hook invoked outside an active Token-2022 transfer"
    },
    {
      "code": 6026,
      "name": "ownerMismatch",
      "msg": "Source token account owner does not match hook owner"
    },
    {
      "code": 6027,
      "name": "sanctionsRootMismatch",
      "msg": "Witness sanctions_root does not match issuer PDA"
    },
    {
      "code": 6028,
      "name": "jurisdictionRootMismatch",
      "msg": "Witness jurisdiction_root does not match issuer PDA"
    },
    {
      "code": 6029,
      "name": "timestampMismatch",
      "msg": "Witness timestamp does not match on-chain clock"
    },
    {
      "code": 6030,
      "name": "zeroSanctionsRoot",
      "msg": "Sanctions root must be non-zero"
    },
    {
      "code": 6031,
      "name": "zeroJurisdictionRoot",
      "msg": "Jurisdiction root must be non-zero"
    },
    {
      "code": 6032,
      "name": "bubblegumTreeNotConfigured",
      "msg": "Bubblegum attestation tree is not initialized (run init_attestation_tree)"
    },
    {
      "code": 6033,
      "name": "bubblegumTreeMismatch",
      "msg": "Merkle tree account does not match global Bubblegum registry"
    },
    {
      "code": 6034,
      "name": "bubblegumCpiFailed",
      "msg": "Bubblegum create_tree_config or mint CPI failed"
    },
    {
      "code": 6035,
      "name": "bubblegumTailInvalid",
      "msg": "Trailing Bubblegum account count is invalid for remaining_accounts split"
    },
    {
      "code": 6036,
      "name": "bubblegumLeafOwnerMismatch",
      "msg": "Bubblegum leaf owner does not match settlement recipient"
    },
    {
      "code": 6037,
      "name": "mintHookMismatch",
      "msg": "Mint's TransferHook extension does not point to this program"
    }
  ],
  "types": [
    {
      "name": "attestationChecked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "issuer",
            "type": "pubkey"
          },
          {
            "name": "nullifierHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "bubblegumTreeRegistry",
      "docs": [
        "One-time registry: which concurrent merkle tree Bubblegum uses for compliance cNFTs."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "merkleTree",
            "type": "pubkey"
          },
          {
            "name": "treeCreatorBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "compressedAccountMetaReadOnly",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "treeInfo",
            "docs": [
              "State Merkle tree context."
            ],
            "type": {
              "defined": {
                "name": "packedStateTreeInfo"
              }
            }
          },
          {
            "name": "address",
            "docs": [
              "Address."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "compressedAttestation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "issuer",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nullifierHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "merkleRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "sanctionsRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "jurisdictionRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "mint",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recipient",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "payer",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "compressedProof",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "a",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "b",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "c",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "extraAccountMetaInput",
      "docs": [
        "Anchor-serializable mirror of `ExtraAccountMeta` (which lacks Anchor derives)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "discriminator",
            "type": "u8"
          },
          {
            "name": "addressConfig",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isSigner",
            "type": "bool"
          },
          {
            "name": "isWritable",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "hookPayload",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "issuer",
            "type": "pubkey"
          },
          {
            "name": "nullifierHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "lightArgs",
            "type": {
              "defined": {
                "name": "stagedLightArgs"
              }
            }
          },
          {
            "name": "proofAndWitness",
            "type": "bytes"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "issuer",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "merkleRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "sanctionsRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "jurisdictionRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "rootSlot",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "packedAddressTreeInfo",
      "docs": [
        "Packed address tree info for instruction data.",
        "Contains indices to address tree accounts and root index."
      ],
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "addressMerkleTreePubkeyIndex",
            "type": "u8"
          },
          {
            "name": "addressQueuePubkeyIndex",
            "type": "u8"
          },
          {
            "name": "rootIndex",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "packedStateTreeInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rootIndex",
            "type": "u16"
          },
          {
            "name": "proveByIndex",
            "type": "bool"
          },
          {
            "name": "merkleTreePubkeyIndex",
            "type": "u8"
          },
          {
            "name": "queuePubkeyIndex",
            "type": "u8"
          },
          {
            "name": "leafIndex",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "proofSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "issuer",
            "type": "pubkey"
          },
          {
            "name": "nullifierHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "merkleRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "sanctionsRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "jurisdictionRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "epoch",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "payer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "stagedLightArgs",
      "docs": [
        "Pre-staged Light CPI arguments stored in the hook payload so the Token-2022",
        "Execute entry — which only receives `amount: u64` as instruction data — can",
        "still drive a Light CPI. Clients must include `set_hook_payload` and the",
        "Token-2022 transfer in a single atomic transaction (same-tx staging),",
        "otherwise the tree-root index and validity proof go stale."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bubblegumTail",
            "docs": [
              "Trailing accounts on Token-2022 `Execute` (after Light metas) for Bubblegum `MintV1`",
              "(`BUBBLEGUM_MINT_V1_ACCOUNT_COUNT`) or `0` when not minting in the hook path."
            ],
            "type": "u8"
          },
          {
            "name": "proofPresent",
            "docs": [
              "Whether a compressed proof is present; mirrors `ValidityProof(Option<_>)`."
            ],
            "type": "bool"
          },
          {
            "name": "proofBytes",
            "docs": [
              "Packed Groth16 proof bytes, only meaningful when `proof_present` is true."
            ],
            "type": {
              "array": [
                "u8",
                128
              ]
            }
          },
          {
            "name": "addressMtIndex",
            "docs": [
              "Index into remaining_accounts of the address merkle tree."
            ],
            "type": "u8"
          },
          {
            "name": "addressQueueIndex",
            "docs": [
              "Index into remaining_accounts of the address queue."
            ],
            "type": "u8"
          },
          {
            "name": "addressRootIndex",
            "docs": [
              "Address-tree root index (for replayability vs. live root)."
            ],
            "type": "u16"
          },
          {
            "name": "outputStateTreeIndex",
            "docs": [
              "Output state-tree index passed to `LightAccount::new_init`."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "validityProof",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "option": {
              "defined": {
                "name": "compressedProof"
              }
            }
          }
        ]
      }
    }
  ]
};
