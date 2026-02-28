import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// 🔥 ASEGÚRATE DE QUE TENGA EL .js AL FINAL
import escenariosRoutes from './modules/escenarios/escenarios.routes.js'; 
import reservasRoutes from './modules/reservas/reservas.routes.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Montamos el dominio de escenarios
app.use('/api/escenarios', escenariosRoutes);
app.use('/api/reservas', reservasRoutes);

app.get('/api/health', (req, res) => {
  res.json({ estado: 'OK', mensaje: '🚀 Servidor Backend funcionando con Arquitectura por Módulos' });
});

app.listen(port, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
});