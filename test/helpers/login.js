import request from 'supertest';

export async function loginComoAdmin(app) {
  return request(app).post('/api/auth/login').send({
    email: process.env.ADMIN_EMAIL || 'admin@escola.com',
    senha: process.env.ADMIN_SENHA || 'admin123',
  });
}

export async function loginComoAluno(app, aluno) {
  return request(app).post('/api/auth/login').send({
    email: aluno.email,
    senha: aluno.senha,
  });
}
