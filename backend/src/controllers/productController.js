import { ProductModel } from "../models/productModel.js";
import { httpError } from "../utils/httpError.js";

export async function listProducts(req, res) {
  const { category } = req.query;
  const products = await ProductModel.list(category ? { category } : {});
  const q = String(req.query.q || "").trim().toLowerCase();
  res.json(q ? products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q)) : products);
}

export async function getProduct(req, res) {
  const product = await ProductModel.findById(req.params.id);
  if (!product) throw httpError(404, "Product not found.");
  res.json(product);
}

export async function createProduct(req, res) {
  const product = await ProductModel.create(req.body);
  res.status(201).json(product);
}

export async function updateProduct(req, res) {
  const product = await ProductModel.update(req.params.id, req.body);
  if (!product) throw httpError(404, "Product not found.");
  res.json(product);
}

export async function deleteProduct(req, res) {
  await ProductModel.remove(req.params.id);
  res.status(204).send();
}
