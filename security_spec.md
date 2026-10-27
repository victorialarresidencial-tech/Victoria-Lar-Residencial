# Victoria Lar Residencial — Especificação de Segurança e Governança de Dados
## Fase 3.2B: Proteção do Cloud Firestore, RBAC Modular e Governança de Dados

### 1. Invariantes de Segurança de Dados

1. **Default-Deny Inviolável**: Toda coleção ou documento não explicitamente liberado é rejeitado na raiz (`match /{document=**} { allow read, write: if false; }`).
2. **Identidade Criptográfica Obrigatória**: Toda escrita ou acesso a dados privados exige `isVerified()`, garantindo que o token JWT do Firebase Auth seja válido e possua `email_verified == true`. Tokens não verificados ou usuários anônimos não possuem acesso a prontuários, colaboradores ou dados administrativos.
3. **Isolamento Modular Estrito (Zero Cross-Module Leak)**:
   - Um colaborador com permissão exclusiva ao módulo `residentes` só pode consultar, cadastrar ou atualizar `/pacientes/{pacienteId}`. Ele está expressamente proibido de ler ou alterar `/funcionarios/{funcionarioId}`.
   - Um colaborador com permissão exclusiva ao módulo `colaboradores` só pode consultar, cadastrar ou atualizar `/funcionarios/{funcionarioId}`. Ele está expressamente proibido de ler ou alterar `/pacientes/{pacienteId}`.
4. **Exclusão de Registros Críticos Restrita à Administração**: Nem colaboradores de enfermagem nem assistentes de RH podem excluir registros de prontuários (`/pacientes`) ou funcionários (`/funcionarios`). A exclusão é prerrogativa exclusiva de administradores ativos (`isActiveAdmin()`).
5. **Gravações em Controle de Acesso Exclusivas do Backend**:
   - `/accessRequests`: Nenhuma escrita direta pelo SDK cliente é permitida (`allow create, update, delete: if false`). Todas as solicitações são processadas via backend confiável com verificação criptográfica e bloqueio de concorrência.
   - `/usuariosAutorizados`: Nenhuma criação, concessão ou alteração de papéis ou módulos pelo SDK cliente é permitida (`allow create, update, delete: if false`). Toda concessão ou revogação é executada por administradores via endpoints do servidor.
   - `/accessRequestLocks`: Coleção interna de lock de concorrência é totalmente fechada para clientes (`allow read, write: if false`).
   - `/admins`: Imutável pelo cliente (`allow create, update, delete: if false`).
   - `/auditLogs`: Forjamento de logs bloqueado (`allow create, update, delete: if false`).
   - `/system/bootstrap` e `/system/superAdminGuard`: Totalmente fechados para escrita do cliente (`allow write: if false`).
6. **Integridade de Esquema e "Anti-Update Gap"**:
   - Tanto na criação quanto na atualização, os documentos são submetidos à validação estrita dos campos obrigatórios, tipos de dados, valores enumerados válidos e limites de comprimento (`isValidPaciente` e `isValidFuncionario`).
   - Campos imutáveis (`criadoEm` e `id`) são protegidos contra alteração indevida durante atualizações.
7. **Privacidade de PII e Dados Clínicos Sensíveis**: Visitantes anônimos não têm leitura (`get` ou `list`) em `/pacientes`, `/funcionarios`, `/leads`, `/admins`, `/auditLogs` ou `/usuariosAutorizados`.

---

### 2. Matriz de Autorização e RBAC Modular

| Coleção / Recurso | Visitante Anônimo | Usuário Comum Autenticado | Colaborador (Módulo `residentes`) | Colaborador (Módulo `colaboradores`) | Administrador Ativo | Superadministrador Ativo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/pacientes` (Read) | ❌ Negado | ❌ Negado | ✅ Permitido | ❌ Negado | ✅ Permitido | ✅ Permitido |
| `/pacientes` (Create/Update) | ❌ Negado | ❌ Negado | ✅ Permitido | ❌ Negado | ✅ Permitido | ✅ Permitido |
| `/pacientes` (Delete) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido |
| `/funcionarios` (Read) | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido | ✅ Permitido |
| `/funcionarios` (Create/Update) | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido | ✅ Permitido |
| `/funcionarios` (Delete) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido |
| `/accessRequests` (Read) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido |
| `/accessRequests` (Write) | ❌ Negado (Server API) | ❌ Negado (Server API) | ❌ Negado | ❌ Negado | ❌ Negado (Server API) | ❌ Negado (Server API) |
| `/usuariosAutorizados` (Read) | ❌ Negado | ✅ Apenas próprio UID | ✅ Apenas próprio UID | ✅ Apenas próprio UID | ✅ Todos | ✅ Todos |
| `/usuariosAutorizados` (Write)| ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado (Server API) | ❌ Negado (Server API) |
| `/accessRequestLocks` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado |
| `/admins` (Read) | ❌ Negado | ✅ Apenas próprio UID | ✅ Apenas próprio UID | ✅ Apenas próprio UID | ✅ Todos | ✅ Todos |
| `/admins` (Write) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado (Server API) | ❌ Negado (Server API) |
| `/services` (Read) | ✅ Apenas Publicados | ✅ Apenas Publicados | ✅ Apenas Publicados | ✅ Apenas Publicados | ✅ Todos (inc. Rascunhos) | ✅ Todos |
| `/services` (Write) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido |
| `/content` (Read) | ✅ Apenas Chaves Públicas | ✅ Apenas Chaves Públicas | ✅ Apenas Chaves Públicas | ✅ Apenas Chaves Públicas | ✅ Todas | ✅ Todas |
| `/content` (Write) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido |
| `/leads` (Create) | ✅ Permitido (Restrito) | ✅ Permitido (Restrito) | ✅ Permitido (Restrito) | ✅ Permitido (Restrito) | ✅ Permitido | ✅ Permitido |
| `/leads` (Read/Update) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido |
| `/leads` (Delete) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido |
| `/auditLogs` (Read) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido |
| `/auditLogs` (Write) | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado (Server API) | ❌ Negado (Server API) |
| `/system/bootstrap` | ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Read (Write bloqueado) | ✅ Read (Write bloqueado) |
| `/albums` / `/photos` (Read) | ✅ Apenas Publicados | ✅ Apenas Publicados | ✅ Apenas Publicados | ✅ Apenas Publicados | ✅ Todos | ✅ Todos |
| `/albums` / `/photos` (Write)| ❌ Negado | ❌ Negado | ❌ Negado | ❌ Negado | ✅ Permitido | ✅ Permitido |

---

### 3. As Cargas "Dirty Dozen" (Testes Adversariais)

1. **Payload 1 — Residentes: Visitante anônimo tenta ler prontuário de paciente**
   - Alvo: `GET /pacientes/paciente_1`
   - Contexto: Não autenticado (`auth: null`)
   - Resultado esperado: `PERMISSION_DENIED`

2. **Payload 2 — Residentes: Colaborador com módulo `colaboradores` tenta ler `/pacientes`**
   - Alvo: `GET /pacientes/paciente_1` e `LIST /pacientes`
   - Contexto: Colaborador com `modulos: ['colaboradores']`
   - Resultado esperado: `PERMISSION_DENIED_MODULE_RESTRICTED`

3. **Payload 3 — Residentes: Colaborador com módulo `residentes` tenta excluir prontuário**
   - Alvo: `DELETE /pacientes/paciente_1`
   - Contexto: Colaborador com `modulos: ['residentes']` (não é administrador)
   - Resultado esperado: `PERMISSION_DENIED_DELETE_REQUIRES_ADMIN`

4. **Payload 4 — Colaboradores: Visitante anônimo tenta ler dados de RH**
   - Alvo: `GET /funcionarios/func_1`
   - Contexto: Não autenticado (`auth: null`)
   - Resultado esperado: `PERMISSION_DENIED`

5. **Payload 5 — Colaboradores: Colaborador com módulo `residentes` tenta consultar lista de funcionários**
   - Alvo: `LIST /funcionarios`
   - Contexto: Colaborador com `modulos: ['residentes']`
   - Resultado esperado: `PERMISSION_DENIED_MODULE_RESTRICTED`

6. **Payload 6 — Colaboradores: Colaborador tenta excluir registro de outro colaborador**
   - Alvo: `DELETE /funcionarios/func_1`
   - Contexto: Colaborador ativo com módulo `colaboradores`
   - Resultado esperado: `PERMISSION_DENIED_DELETE_REQUIRES_ADMIN`

7. **Payload 7 — Controle de Acesso: Usuário tenta criar/escrever diretamente em `/usuariosAutorizados`**
   - Alvo: `POST /usuariosAutorizados/my_uid` com `{ role: 'admin', modulos: ['residentes', 'colaboradores'] }`
   - Contexto: Usuário autenticado comum
   - Resultado esperado: `PERMISSION_DENIED_STAFF_CLIENT_WRITE_BLOCKED`

8. **Payload 8 — Controle de Acesso: Usuário tenta autoaprovar solicitação diretamente em `/accessRequests`**
   - Alvo: `UPDATE /accessRequests/my_req` com `{ status: 'aprovada' }`
   - Contexto: Usuário autenticado
   - Resultado esperado: `PERMISSION_DENIED_ACCESS_REQUEST_CLIENT_WRITE_BLOCKED`

9. **Payload 9 — Concorrência: Usuário tenta manipular locks em `/accessRequestLocks`**
   - Alvo: `SET /accessRequestLocks/my_uid` com `{ locked: false }`
   - Contexto: Usuário autenticado
   - Resultado esperado: `PERMISSION_DENIED_LOCK_CLIENT_WRITE_BLOCKED`

10. **Payload 10 — Integridade de Esquema: Injeção de "Ghost Field" em Prontuário de Paciente**
    - Alvo: `CREATE /pacientes/paciente_hacked` com campo proibido `privilegiosOcultos: true`
    - Contexto: Colaborador com módulo `residentes`
    - Resultado esperado: `PERMISSION_DENIED_GHOST_FIELD`

11. **Payload 11 — Usuário Desativado: Colaborador desativado tenta ler prontuários**
    - Alvo: `GET /pacientes/paciente_1`
    - Contexto: Colaborador com `ativo: false` no documento de `/usuariosAutorizados`
    - Resultado esperado: `PERMISSION_DENIED_DEACTIVATED_STAFF`

12. **Payload 12 — E-mail Não Verificado: Usuário com token Google `email_verified: false` tenta acessar `/pacientes`**
    - Alvo: `GET /pacientes/paciente_1`
    - Contexto: Usuário com `email_verified: false`
    - Resultado esperado: `PERMISSION_DENIED_UNVERIFIED_EMAIL`
