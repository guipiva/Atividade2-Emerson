import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

/** Tipo que representa um usuário que será salvo no banco de dados */
type UsuarioPayload = {
	nome: string;
	email: string;
	cpf: string;
};

// Inicializa a aplicação Express
const app = express();
const PORT = 3333;

// Middleware CORS - permite requisições de diferentes origens
app.use(cors());
// Middleware que permite parsear JSON no corpo das requisições
app.use(express.json());

/** 
 * Promise que gerencia a conexão com o banco SQLite
 * O arquivo do banco fica salvo em ./fatec-local.db
 */
const dbPromise = open({
	filename: './fatec-local.db',
	driver: sqlite3.Database,
});

/**
 * Função que garante que a tabela USUARIO existe no banco
 * Se não existir, cria a tabela com os campos necessários
 */
async function ensureSchema() {
	const db = await dbPromise;
	// Cria a tabela se não existir
	await db.exec(`
		CREATE TABLE IF NOT EXISTS USUARIO(
			ID_US INTEGER PRIMARY KEY AUTOINCREMENT,
			NOME_US VARCHAR(100),
			EMAIL_US VARCHAR(100),
			CPF_US VARCHAR(11)
		)
	`);

	// Tenta adicionar coluna CPF (se já existir, o catch ignora o erro)
	await db.exec('ALTER TABLE USUARIO ADD COLUMN CPF_US VARCHAR(11)').catch(() => null);
}

/**
 * Insere um novo usuário no banco de dados
 * @param payload - Objeto com nome, email e CPF do usuário
 */
async function InserirUsuario(payload: UsuarioPayload) {
	const db = await dbPromise;
	await db.run(
		'INSERT INTO USUARIO(NOME_US, EMAIL_US, CPF_US) VALUES(?,?,?)',
		payload.nome,
		payload.email,
		payload.cpf,
	);
}

/**
 * Busca todos os usuários cadastrados no banco
 * Ordena por ID em ordem decrescente (mais recentes primeiro)
 */
async function selectUsuarios() {
	const db = await dbPromise;
	return db.all('SELECT * FROM USUARIO ORDER BY ID_US DESC');
}

/**
 * Busca um usuário específico pelo CPF
 * @param cpf - O CPF do usuário a ser buscado
 * @returns O usuário encontrado ou undefined se não existir
 */
async function SelectUsuariosId(cpf: string) {
	const db = await dbPromise;
	return db.get('SELECT * FROM USUARIO WHERE CPF_US = ?', cpf);
}

/**
 * ROTA GET: /usuarios
 * Retorna todos os usuários cadastrados no banco
 * Resposta: Array com todos os usuários
 */
app.get('/usuarios', async (_req: Request, res: Response) => {
	try {
		const users = await selectUsuarios();
		res.json(users);
	} catch {
		res.status(500).json({ message: 'Erro ao consultar cadastros.' });
	}
});

/**
 * ROTA GET: /usuarios/cpf/:cpf
 * Busca um usuário específico pelo CPF
 * Parâmetro: cpf (ex: /usuarios/cpf/12345678901)
 * Resposta: Dados do usuário ou erro 404 se não encontrado
 */
app.get('/usuarios/cpf/:cpf', async (req: Request, res: Response) => {
	try {
		// Garante que cpfParam é uma string (não array)
		const cpfParam = Array.isArray(req.params.cpf)
			? req.params.cpf[0]
			: req.params.cpf;
		// Busca o usuário pelo CPF
		const user = await SelectUsuariosId(cpfParam ?? '');
		// Se não encontrar, retorna 404
		if (!user) {
			return res.status(404).json({ message: 'Cadastro nao encontrado.' });
		}
		// Retorna os dados do usuário
		res.json(user);
	} catch {
		res.status(500).json({ message: 'Erro ao consultar CPF.' });
	}
});

/**
 * ROTA POST: /usuarios
 * Cria um novo usuário no banco de dados
 * Corpo da requisição: { nome, email, cpf }
 * Resposta: Mensagem de sucesso e status 201
 */
app.post('/usuarios', async (req: Request, res: Response) => {
	try {
		// Extrai os dados do corpo da requisição
		const payload = req.body as UsuarioPayload;
		// Insere o usuário no banco
		await InserirUsuario(payload);
		// Retorna sucesso com status 201 (Created)
		res.status(201).json({ message: 'Cadastro realizado com sucesso.' });
	} catch {
		res.status(500).json({ message: 'Erro ao cadastrar usuario.' });
	}
});

/**
 * ROTA PUT: /usuarios/:id
 * Atualiza um usuário existente no banco
 * Parâmetro: id (ID do usuário a atualizar)
 * Corpo da requisição: { nome, email, cpf }
 * Resposta: Mensagem de sucesso
 */
app.put('/usuarios/:id', async (req: Request, res: Response) => {
	try {
		// Extrai os dados do corpo da requisição
		const payload = req.body as UsuarioPayload;
		const db = await dbPromise;
		// Atualiza o usuário no banco baseado no ID
		await db.run(
			'UPDATE USUARIO SET NOME_US = ?, EMAIL_US = ?, CPF_US = ? WHERE ID_US = ?',
			payload.nome,
			payload.email,
			payload.cpf,
			Number(req.params.id),
		);
		res.json({ message: 'Cadastro atualizado com sucesso.' });
	} catch {
		res.status(500).json({ message: 'Erro ao atualizar cadastro.' });
	}
});

/**
 * ROTA DELETE: /usuarios/:id
 * Deleta um usuário do banco de dados
 * Parâmetro: id (ID do usuário a deletar)
 * Resposta: Mensagem de sucesso
 */
app.delete('/usuarios/:id', async (req: Request, res: Response) => {
	try {
		const db = await dbPromise;
		// Deleta o usuário base no ID
		await db.run('DELETE FROM USUARIO WHERE ID_US = ?', Number(req.params.id));
		res.json({ message: 'Cadastro excluido com sucesso.' });
	} catch {
		res.status(500).json({ message: 'Erro ao excluir cadastro.' });
	}
});

/**
 * Inicializa o servidor:
 * 1. Garante que o banco de dados e tabela existem
 * 2. Inicia o servidor na porta 3333
 */
ensureSchema().then(() => {
	app.listen(PORT, () => {
		console.log(`API local em http://localhost:${PORT}`);
	});
});
