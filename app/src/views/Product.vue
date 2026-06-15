<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../../utils/supabase";

//kunin ang ID sa URL
const router = useRouter();
const route = useRoute();
const id = route.params.id;
const name = ref("");
const price = ref(0);

async function getProduct() {
  let { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  name.value = products.product_name;
  price.value = products.price;
}

async function updateProduct() {
  const { error } = await supabase
    .from("products")
    .update({ product_name: name.value, price: price.value })
    .eq("id", id)
    .select();

  router.push("/");
}

onMounted(() => [getProduct()]);
</script>

<template>
  <div class="page">
    <button class="back" @click="router.push('/')">← Back</button>
    <h1 class="title">Edit Product</h1>

    <div class="form">
      <label>Product Name</label>
      <input v-model="name" class="field" placeholder="Name Product" />

      <label>Product Price</label>
      <input v-model="price" class="field" placeholder="Price" />

      <button @click="updateProduct" class="btn">Save</button>
    </div>
  </div>
</template>

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

.back {
  background: none;
  border: none;
  font-family: "DM Mono", monospace;
  font-size: 0.75rem;
  color: #999;
  cursor: pointer;
  padding: 0;
  margin-bottom: 2rem;
}

.back:hover {
  color: #111;
}

.title {
  font-family: "Cormorant", serif;
  font-size: 2.8rem;
  font-weight: 400;
  margin-bottom: 2.5rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

label {
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #999;
}

.field {
  background: transparent;
  border: none;
  border-bottom: 1px solid #c8c4bb;
  padding: 0.4rem 0;
  font-family: "DM Mono", monospace;
  font-size: 0.8rem;
  color: #111;
  outline: none;
  margin-bottom: 0.75rem;
}

.field:focus {
  border-bottom-color: #111;
}

.btn {
  margin-top: 0.5rem;
  align-self: flex-start;
  background: #111;
  color: #f7f6f3;
  border: none;
  padding: 0.45rem 1.1rem;
  font-family: "DM Mono", monospace;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.btn:hover {
  opacity: 0.75;
}
</style>
