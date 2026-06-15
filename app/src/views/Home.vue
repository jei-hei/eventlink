<script setup>
import { useRouter } from "vue-router";
import { supabase } from "../../utils/supabase";
import { onMounted, ref } from "vue";

const router = useRouter();

const name = ref("");
const price = ref(0);
const products = ref([]);

async function getAllProducts() {
  const { data } = await supabase.from("products").select();
  products.value = data;
}

async function insertProduct() {
  const { error } = await supabase
    .from("products")
    .insert([{ product_name: name.value, price: price.value }])
    .select();

  if (!error) {
    getAllProducts();
    console.log("succes");
    name.value = "";
    price.value = "";
  } else {
    console.log(error);
  }
}

async function deleteProduct(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (!error) {
    getAllProducts();
    console.log("succes");
  } else {
    console.log(error);
  }
}

function goToProduct(id) {
  router.push(`/products/${id}`);
}

onMounted(() => {
  getAllProducts();
});
</script>

<template>
  <div class="page">
    <header class="page-header">
      <p class="label">inventory</p>
      <h1 class="title">Products</h1>
    </header>

    <section class="form">
      <input v-model="name" class="field" placeholder="Product Name" />
      <input v-model="price" class="field" placeholder="Price" />
      <button @click="insertProduct" class="btn">Add</button>
    </section>

    <section class="list">
      <div class="list-header">
        <span>Product Name, Price</span>
      </div>
      <ul>
        <li v-for="product in products" :key="product.id">
          <span>{{ product.product_name + " " + product.price + " " }}</span>
          <button @click="deleteProduct(product.id)" class="btn">Delete</button>
          <button @click="goToProduct(product.id)" class="btn">Edit</button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style>
body {
  background: #f7f6f3;
  margin: 0;
}
</style>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500&family=DM+Mono:wght@300;400&display=swap");

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.page {
  min-height: 100vh;
  background: #f7f6f3;
  color: #111;
  font-family: "DM Mono", monospace;
  padding: 4rem 2rem;
  max-width: 560px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2.5rem;
  border-bottom: 1px solid #d4d0c8;
  padding-bottom: 1rem;
}

.label {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #999;
  margin-bottom: 0.35rem;
}

.title {
  font-family: "Cormorant", serif;
  font-size: 2.8rem;
  font-weight: 400;
  line-height: 1;
  color: #111;
}

.form {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}

.field {
  flex: 1;
  min-width: 120px;
  background: transparent;
  border: none;
  border-bottom: 1px solid #c8c4bb;
  padding: 0.4rem 0;
  font-family: "DM Mono", monospace;
  font-size: 0.8rem;
  color: #111;
  outline: none;
  transition: border-color 0.2s;
}

.field::placeholder {
  color: #aaa;
}

.field:focus {
  border-bottom-color: #111;
}

.btn {
  background: #111;
  color: #f7f6f3;
  border: none;
  padding: 0.45rem 1.1rem;
  font-family: "DM Mono", monospace;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn:hover {
  opacity: 0.75;
}

.list {
  font-size: 0.8rem;
}

.list-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #999;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #d4d0c8;
  margin-bottom: 0.25rem;
}

ul {
  list-style: none;
}

.list-row {
  display: flex;
  justify-content: space-between;
  padding: 0.65rem 0;
  border-bottom: 1px solid #eae8e3;
  color: #222;
}

.empty {
  color: #bbb;
  font-size: 0.75rem;
  padding-top: 1rem;
}
</style>
