import React from "react";
import Feature from "../Features/Feature";
import { MdGppGood, MdLibraryAddCheck, MdLock, MdShare } from "react-icons/md";

const Features = () => {
  return (
    <div className="features-wrapper">
      <div className="title-large">Amazing Features</div>
      <div className="title-small">
        Using Blockchain Ensures these Important safety Features
      </div>

      <div className="mobile-wrapper">
        <div>
          <Feature title="Immutability" icon={<MdLock />} align="right">
            <p>
              Immutability means something that can’t be changed or altered.
              This is one of the top blockchain features that help to ensure
              that the technology will remain as it is, a permanent, unalterable
              network.
            </p>
          </Feature>
        </div>

        <div className="mobile-container">
          <img src="/mobile.png" />
        </div>

        <div>
          <Feature title="Enhanced Security" icon={<MdGppGood />} align="left">
            <p>
            Blockchain relies on cryptographic techniques to secure transactions. 
            Each user has a private key to sign their vote, and the public key is used to
            verify the authenticity of the vote. This cryptographic layer adds an extra level
             of security to the e-voting process.
            </p>
          </Feature>
        </div>
        <div>
          <Feature title="Decentralized" icon={<MdShare />} align="right">
            <p>
            A decentralized blockchain is a distributed and tamper-resistant digital 
            ledger that records transactions across a network of computers, removing 
            the need for a central authority and promoting security, transparency, and 
            censorship resistance.
            </p>
          </Feature>
        </div>
        <div>
          <Feature
            title="Distributed Ledger"
            icon={<MdLibraryAddCheck />}
            align="left"
          >
            <p>
            A distributed ledger blockchain is a decentralized, transparent, and secure digital
             record-keeping system that utilizes a network of computers to maintain a shared database
              of transactions, ensuring immutability and eliminating the need for a central authority.
            </p>
          </Feature>
        </div>
      </div>
    </div>
  );
};

export default Features;
