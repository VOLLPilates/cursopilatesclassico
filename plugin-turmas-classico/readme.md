# Turmas Pilates Clássico (WordPress)

Plugin para gerenciar **turmas** em dois grupos: **Final de Semana** e **Meio da Semana**, com campos por turma (número, datas dos módulos, status, vagas e destaque).

## 🚀 Instalação
1. Copie a pasta do plugin para `wp-content/plugins/`.
2. Ative em **Plugins > Instalados**.
3. Abra o post/CPT onde o metabox de turmas aparece.

## 🖥️ Uso (Admin)
1. Clique **Adicionar Turma** no bloco desejado.
2. Preencha **Número**, **Módulos (datas)**, **Status**, **Vagas**, **Destaque**.
3. O título do card refletirá o número digitado.  
4. **Excluir** um card não altera o número dos demais (o título vem do campo, não da posição).

## ✅ Requisitos
- WordPress **6.0+**
- PHP **7.4+**

## 📂 Arquivos principais
- `turmas-pilates.php` – metabox, salvamento (reindexação) e JS do admin  
- `shortcode.php` – exibição no front-end  
- `frontend.js` / `admin.js` / `datepicker.js`
- `admin.css` / `frontend.css`