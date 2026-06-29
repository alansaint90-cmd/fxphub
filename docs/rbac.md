# RBAC

## Roles

| Role | Nivel | Acesso |
| --- | ---: | --- |
| `super_admin` | 0 | Tudo, incluindo auditoria e configuracoes sensiveis |
| `admin` | 1 | Usuarios, leads, relatorios e integracoes |
| `operador` | 2 | Atendimento, leads e agendamentos |
| `visualizador` | 3 | Somente leitura |

## Regra

Toda action ou rota administrativa deve validar sessao e permissao antes de consultar dados.
O webhook Evolution e uma rota de sistema e deve ser protegido por segredo/assinatura quando publicado.
