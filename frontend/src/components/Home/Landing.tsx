import React from "react";
import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="landing">
      <div className="left">
        <div className="logo">
          <img src="logo.png" />
        </div>

        <div className="title-large underline">VOTE AWAAZ</div>
        <div className="title-small" style={{ marginBottom: "10px" }}>-------------------------------------- </div>
        <div className="title-large">Give your Votes a Voice & </div>
       
        <div className="title-small">Let's change the world together</div>

        <div className="button-wrapper">
          <Link to="/login">
            <button className="button-black">Login</button>
          </Link>

          <Link to="/view">
            <button>View Votes</button>
          </Link>
        </div>
      </div>

      <div className="right">
        <img src="vote.gif" />
      </div>
    </div>
  );
};

export default Landing;
