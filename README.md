# SANDITEL
+-------------------+
                                  |   ADMIN PORTAL    | (Admin & Tech Users)
                                  | (Next.js Frontend)| Page B
                                  +---------+---------+
                                            | (HTTPS)
                                            v
                                  +---------+---------+
                                  | WAREHOUSE PORTAL  | (Warehouse Users)
                                  | (Next.js Frontend)| Page A
                                  +---------+---------+
                                            | (HTTPS)
                                            v
+-------------------------------------------+-----------------------------------------------+
|                                     API GATEWAY / REVERSE PROXY                           |
|                               (Misal: Traefik / Nginx / KrakenD)                          |
|    - Handles Routing                                                                      |
|    - Centralized SSL                                                                      |
|    - Rate Limiting                                                                        |
+-------+----------------+------------------+-------------------+-----------------+-------+
        |                |                  |                   |                 |
        | (HTTP/gRPC)    | (HTTP/gRPC)      | (HTTP/gRPC)       | (HTTP/gRPC)     | (Internal Connect)
        v                v                  v                   v                 v
+-------+-------+  +-----+--------+  +------+---------+  +------+---------+  +----+----+
| AUTH SERVICE  |  | ADMIN SERVICE |  | TECH SERVICE    |  | WAREHOUSE SRV  |  |S3 ADAPTER| (Optional Internal
| (Go)          |  | (Go)          |  | (Go)            |  | (Go)           |  | (Go)    | Service for abstraction)
| - JWT Issue   |  | - File Meta   |  | - Asset Mgmt   |  | - Inventory    |  +----+----+
| - User Roles  |  | - Permissions |  | - Monitoring   |  | - Stock Opname |       |
+-------+-------+  +-----+--------+  +------+---------+  +------+---------+       | (S3 Protocol)
        |                |                  |   |               |                 v
        v                v                  v   v               v             +---+---+
+-------+-------+  +-----+--------+  +------+--+----+   +-------+-------+     |AWS S3/|
| POSTGRES DB   |  | POSTGRES DB  |  | POSTGRES REDIS  |   | POSTGRES DB   |     |MINIO  |
| (auth_db)     |  | (admin_db)   |  | DB (tech_db)    |   | (warehouse_db)|     |(Files)|
+---------------+  +--------------+  +-----------------+   +---------------+     +-------+