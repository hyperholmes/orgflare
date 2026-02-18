# OpenCog Components Research

## OpenCog AtomSpace (Core - Active, Stable, Supported as of 2025)

| Component | Repository | Description | Status |
|-----------|------------|-------------|--------|
| AtomSpace | opencog/atomspace | Hypergraph database and query engine | Active (929 stars) |
| Storage | opencog/atomspace-storage | Base class for saving, loading, sending and receiving Atoms | Active |
| CogServer | opencog/cogserver | Distributed AtomSpace Network Server | Active (25 stars) |
| atomspace-cog | opencog/atomspace-cog | Distributed AtomSpace Network client | Active |
| atomspace-rocks | opencog/atomspace-rocks | Disk I/O storage based on RocksDB | Active |
| Proxy Nodes | - | Managing Atoms flowing through large Atomspaces | Active |
| Sparse Vectors/Matrix | - | Working with graphs as embeddings in sparse vectors | Active |
| Link Grammar | opencog/link-grammar | Maximal Planar Graph (MPG) parsing, NLP | Active (404 stars) |
| Docker containers | - | System integration and demos | Active |
| atomspace-pgres | opencog/atomspace-pgres | Postgres StorageNode | Deprecated |
| cogutil | opencog/cogutil | Low-level C++ programming utilities | Active |
| unify | opencog/unify | Atomese expression unifier | Active |

## OpenCog Research (Active Development)

| Component | Repository | Description | Status |
|-----------|------------|-------------|--------|
| Sensory | opencog/sensory | Dataflow of graphlets to/from external world, Agents I/O | Active |
| Atomese-SIMD | opencog/atomese-simd | Flowing data to GPU's and SIMD (OpenCL/CUDA) hardware | Active |
| Learn | opencog/learn | Symbolic learning (batch-based processing) | Active (181 stars) |
| Agents | opencog/agents | Refactoring learning for interactive environment | Active |
| Motor | opencog/motor | Controlling focus of sensory attention, Perception-action | Active |

## OpenCog Fossils (Deprecated/Abandoned)

| Component | Description | Status |
|-----------|-------------|--------|
| PLN | Probabilistic Logic Networks | Deprecated |
| URE | Unified Rule Engine | Deprecated |
| Attention | Attention allocation | Deprecated |
| Ghost | Chatbot scripting | Deprecated |
| Relex | Relation extraction | Deprecated |
| R2L | Relex to Logic | Deprecated |
| ROS | Robot Operating System integration | Deprecated |
| Eva/Sophia | Hanson Robotics integration | Deprecated |
| MOSES | Meta-Optimizing Semantic Evolutionary Search | Deprecated (but as-moses active) |

## OpenCog Incubator (Promising/Incomplete)

| Component | Repository | Description | Status |
|-----------|------------|-------------|--------|
| as-moses | opencog/asmoses | Port of MOSES to AtomSpace | Incubator (45 stars) |
| SQL Bridge | - | Direct I/O between SQL and AtomSpace | Incubator |
| Prolog-on-Atomspace | - | Proof-of-concept | Incubator |
| Chemistry | - | Molecular bonds, structural formulas | Incubator |
| agi-bio | opencog/agi-bio | Genomics, proteomics (MOZI, rejuve.bio) | Incubator |
| Vision | - | Extracting structure from images/video | Incubator |
| Hyperon-on-top-of-atomspace | - | Hyperon backwards-compat layer | Incubator |
| SpaceTime | opencog/spacetime | Octree spatial bounding boxes, time intervals | Incubator |

## OpenCog Hyperon (Next Generation - SingularityNET)

| Component | Description | Status |
|-----------|-------------|--------|
| Hyperon | Substantially revised novel version of OpenCog | Active Development |
| MeTTa | Meta Type Talk language | Active |
| Distributed AtomSpace (DAS) | New-age knowledge repository | Active |

## Key Technologies

- **Languages**: C++, Python, Scheme, JavaScript, CMake
- **Storage**: RocksDB, PostgreSQL
- **Networking**: JSON, WebSockets
- **GPU**: OpenCL, CUDA (via Atomese-SIMD)

## Repository Statistics (as of Dec 2025)

- Total Repositories: 88
- Contributors: 24
- Primary Language: C++
