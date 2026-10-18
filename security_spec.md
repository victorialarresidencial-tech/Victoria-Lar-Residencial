# Especificação de Segurança e Matriz de Invariantes — Victoria Lar Residencial

## 1. Invariantes de Dados Fundamentais

1. **Invariante de Bloqueio Padrão (Zero-Trust Default Deny)**: Qualquer caminho não explicitamente autorizado tem leitura e escrita sumariamente negadas (`allow read, write: if false;`).
2. **Invariante do Administrador Ativo (Live Active Check)**: Permissões administrativas exigem documento existente na coleção `/admins/{uid}` com `active == true`. Tokens estáticos não conferem privilégios sem confirmação em tempo real no banco.
3. **Invariante de Isolamento de Rascunhos ("Rules Are Not Filters")**: Documentos na coleção `/services/{serviceId}` com `status != 'published'` NUNCA podem ser lidos ou listados por visitantes ou usuários não-administradores. Listagens públicas DEVEM restringir a consulta para `status == 'published'`.
4. **Invariante de Dados Privados / Leads**: A coleção `/leads/{leadId}` contém PII (nome, telefone, e-mail, interesse de idosos). O público externo JAMAIS pode ler, listar ou alterar leads.
5. **Invariante de Bootstrap Permanente e Inviolável**: O documento `/system/bootstrap` aceita transição de inicialização apenas se `lockedPermanently != true`. Uma vez selado, nenhuma escrita de bootstrap é permitida.
6. **Invariante de Proteção ao Último Superadministrador**: O sistema não permite que o contador de superadministradores ativos caia para zero, impedindo bloqueio administrativo involuntário ou malicioso.
7. **Invariante de Integridade de Autoria e Timestamps**: Administradores não podem forjar identidades de criadores ou datas arbitrárias. `updatedBy` deve corresponder a `request.auth.uid` e `updatedAt` deve ser consistente.
8. **Invariante de Restrição de Chaves e Tamanhos (Anti-Denial-of-Wallet)**: Toda escrita deve cumprir validação de campos permitidos (`hasOnly`) e limites rígidos de tamanho de caracteres em strings e identificadores.

---

## 2. As "Doze Cargas Maliciosas" (The Dirty Dozen Payloads)

| # | Vetor de Ataque | Alvo | Carga Maliciosa | Resultado Esperado |
|---|----------------|------|-----------------|-------------------|
| 1 | **Ghost Field Injection** | `/services/serv_1` | `{ "title": "Médico 24h", "status": "published", "order": 1, "hackedRoot": true }` | `PERMISSION_DENIED` |
| 2 | **Public Draft Snooping** | `/services/draft_serv` (get) | Leitura direta sem autenticação de serviço com status `'draft'` | `PERMISSION_DENIED` |
| 3 | **Unconstrained List Query** | `/services` (list) | Consulta pública sem `where("status", "==", "published")` | `PERMISSION_DENIED` |
| 4 | **Revoked Admin Tampering** | `/content/about` | Escrita por administrador com `active: false` usando token JWT ainda válido | `PERMISSION_DENIED` |
| 5 | **Public Lead Exfiltration** | `/leads` (list/get) | Leitura anônima de lista de contatos e telefones de famílias | `PERMISSION_DENIED` |
| 6 | **Self-Promotion to SuperAdmin** | `/admins/{visitorUid}` | Criação direta de admin por usuário anônimo: `{ "role": "superadmin", "active": true }` | `PERMISSION_DENIED` |
| 7 | **Bootstrap Replay Attack** | `/system/bootstrap` | Sobrescrita do status para `'UNINITIALIZED'` após conclusão | `PERMISSION_DENIED` |
| 8 | **ID Poisoning / Denial of Wallet** | `/services/{longJunkId}` | ID de documento com 2KB de caracteres inválidos (`/services/$$$###...`) | `PERMISSION_DENIED` |
| 9 | **String Overflow Exploit** | `/services/serv_2` | Campo `title` com 10.000 caracteres | `PERMISSION_DENIED` |
| 10| **Direct Public Lead Modification** | `/leads/lead_1` | Modificação de status do lead por visitante: `{ "status": "archived" }` | `PERMISSION_DENIED` |
| 11| **Audit Log Tampering / Deletion** | `/auditLogs/log_1` | Tentativa de alteração ou exclusão de histórico de auditoria por qualquer usuário | `PERMISSION_DENIED` |
| 12| **Immutable Field Mutation** | `/services/serv_3` | Alteração de `id` ou `createdAt` original em atualização de serviço | `PERMISSION_DENIED` |
