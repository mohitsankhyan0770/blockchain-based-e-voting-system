// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4 <0.9.0;

/**
 * @title Election
 * @notice Append-only ledger for small-scale elections (colleges, clubs).
 *
 * Trust model (read this before relying on it):
 *  - Voters are authenticated OFF-chain by the backend (login + admin verification).
 *  - The backend's account is an admin and is the only account allowed to record votes.
 *  - The contract guarantees what the backend cannot quietly undo: one vote per voter
 *    hash per election, a fixed candidate list, no changes after the election ends,
 *    and a public event log anyone can audit.
 *  - It does NOT make the backend trustless. A malicious backend could cast votes for
 *    people who never voted. That is a known limit of this design.
 *
 * Privacy: voters are stored only as an opaque 32-byte hash chosen by the backend
 * (see backend/src/chain.ts). No names or ids are written to the chain.
 */
contract Election {
    enum Status {
        NotStarted,
        Running,
        Finished
    }

    struct Candidate {
        string name;
        string info;
        uint256 votes;
    }

    uint256 public constant MAX_CANDIDATES = 50;

    address public owner;
    mapping(address => bool) public admins;

    /// Incremented by resetElection(). All election data is keyed by round, so a reset
    /// costs the same gas no matter how many votes there were, and past rounds stay readable.
    uint256 public currentRound;
    Status public status;
    uint256 public totalVotes;

    mapping(uint256 => string) private roundName;
    mapping(uint256 => string) private roundDescription;
    mapping(uint256 => Candidate[]) private candidatesByRound;
    mapping(uint256 => mapping(bytes32 => bool)) private votedByRound;

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event ElectionStarted(uint256 indexed round, string name, uint256 candidateCount);
    event VoteCast(uint256 indexed round, bytes32 indexed voterHash, uint256 candidateIndex);
    event ElectionEnded(uint256 indexed round, uint256 totalVotes);
    event ElectionReset(uint256 indexed newRound);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin");
        _;
    }

    constructor() {
        owner = msg.sender;
        admins[msg.sender] = true;
        emit AdminAdded(msg.sender);
    }

    // ---------------------------------------------------------------- admin management

    function addAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Zero address");
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) external onlyOwner {
        require(_admin != owner, "Cannot remove owner");
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    // ---------------------------------------------------------------- election lifecycle

    /// Creates the election, its candidates and opens voting in one atomic transaction.
    function startElection(
        string calldata _name,
        string calldata _description,
        string[] calldata _candidateNames,
        string[] calldata _candidateInfos
    ) external onlyAdmin {
        require(status == Status.NotStarted, "Election already started");
        require(bytes(_name).length > 0, "Empty election name");
        require(_candidateNames.length == _candidateInfos.length, "Length mismatch");
        require(_candidateNames.length >= 2, "At least 2 candidates");
        require(_candidateNames.length <= MAX_CANDIDATES, "Too many candidates");

        for (uint256 i = 0; i < _candidateNames.length; i++) {
            require(bytes(_candidateNames[i]).length > 0, "Empty candidate name");
            bytes32 nameHash = keccak256(bytes(_candidateNames[i]));
            for (uint256 j = 0; j < i; j++) {
                require(nameHash != keccak256(bytes(_candidateNames[j])), "Duplicate candidate");
            }
            candidatesByRound[currentRound].push(
                Candidate({name: _candidateNames[i], info: _candidateInfos[i], votes: 0})
            );
        }

        roundName[currentRound] = _name;
        roundDescription[currentRound] = _description;
        totalVotes = 0;
        status = Status.Running;

        emit ElectionStarted(currentRound, _name, _candidateNames.length);
    }

    /// Records one vote. `_voterHash` must be derived off-chain and must not reveal identity.
    function vote(bytes32 _voterHash, uint256 _candidateIndex) external onlyAdmin {
        require(status == Status.Running, "Election not running");
        require(_candidateIndex < candidatesByRound[currentRound].length, "Invalid candidate");
        require(!votedByRound[currentRound][_voterHash], "Already voted");

        votedByRound[currentRound][_voterHash] = true;
        candidatesByRound[currentRound][_candidateIndex].votes += 1;
        totalVotes += 1;

        emit VoteCast(currentRound, _voterHash, _candidateIndex);
    }

    function endElection() external onlyAdmin {
        require(status == Status.Running, "Election not running");
        status = Status.Finished;
        emit ElectionEnded(currentRound, totalVotes);
    }

    /// Clears the live state for a new election. Finished rounds remain readable via getResultsOf().
    function resetElection() external onlyAdmin {
        require(status == Status.Finished, "Election not finished");
        currentRound += 1;
        totalVotes = 0;
        status = Status.NotStarted;
        emit ElectionReset(currentRound);
    }

    // ---------------------------------------------------------------- views

    function getStatus() external view returns (string memory) {
        if (status == Status.Running) return "running";
        if (status == Status.Finished) return "finished";
        return "not-started";
    }

    function getElectionName() external view returns (string memory) {
        return roundName[currentRound];
    }

    function getElectionDescription() external view returns (string memory) {
        return roundDescription[currentRound];
    }

    function getCandidates() external view returns (string[] memory names) {
        return _names(currentRound);
    }

    function getResults() external view returns (string[] memory names, uint256[] memory counts) {
        return _results(currentRound);
    }

    /// Results of the current or any past round.
    function getResultsOf(uint256 _round)
        external
        view
        returns (string memory name, string[] memory names, uint256[] memory counts)
    {
        require(_round <= currentRound, "No such round");
        (names, counts) = _results(_round);
        return (roundName[_round], names, counts);
    }

    function hasVoted(bytes32 _voterHash) external view returns (bool) {
        return votedByRound[currentRound][_voterHash];
    }

    // ---------------------------------------------------------------- internals

    function _names(uint256 _round) private view returns (string[] memory names) {
        Candidate[] storage list = candidatesByRound[_round];
        names = new string[](list.length);
        for (uint256 i = 0; i < list.length; i++) {
            names[i] = list[i].name;
        }
    }

    function _results(uint256 _round) private view returns (string[] memory names, uint256[] memory counts) {
        Candidate[] storage list = candidatesByRound[_round];
        names = new string[](list.length);
        counts = new uint256[](list.length);
        for (uint256 i = 0; i < list.length; i++) {
            names[i] = list[i].name;
            counts[i] = list[i].votes;
        }
    }
}
