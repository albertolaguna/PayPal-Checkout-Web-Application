<script setup>
import { loadScript } from "@paypal/paypal-js";
import { onMounted, reactive } from 'vue'
import * as constants from './constants.js'

let productsInCart = reactive([
  {
    id: "1",
    name: 'Product 1',
    price: 200.5,
    quantity: 2
  },
  {
    id: "2",
    name: 'Product 2',
    price: 150,
    quantity: 1
  },
])

let total = reactive(productsInCart.reduce(
  (x, y) => x.price * x.quantity + y.price * y.quantity
))

let userInfo = reactive({
  email_address: "",
  name: {
    given_name: "",
    surname: "",
  },
  phone: {
    phone_type: "",
    phone_number: {
      national_number: "",
    },
  },
  address: {
    address_line_1: "",
    address_line_2: "",
    admin_area_2: "",
    admin_area_1: "",
    postal_code: "",
    country_code: "",
  }
})

function addOne(product) {
  product.quantity += 1
  total = productsInCart.reduce(
    (x, y) => x.price * x.quantity + y.price * y.quantity
  )
}

function removeOne(product) {
  if (product.quantity > 0) {
    product.quantity -= 1
    total = productsInCart.reduce(
      (x, y) => x.price * x.quantity + y.price * y.quantity
    )
  }
}

function resultMessage(message) {
  alert(message)
}

function hasEmptyString(obj) {
  for (let key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      if (hasEmptyString(obj[key])) {
        return true;
      }
    } else if (obj[key] === "") {
      return true;
    }
  }
  return false
}

function verifyEmail(email) {
  return new RegExp("^[a-z|0-9|A-Z]*([_][a-z|0-9|A-Z]+)*([.][a-z|0-9|A-Z]+)*([.][a-z|0-9|A-Z]+)*(([_][a-z|0-9|A-Z]+)*)?@[a-z][a-z|0-9|A-Z]*\.([a-z][a-z|0-9|A-Z]*(\.[a-z][a-z|0-9|A-Z]*)?)$").test(email)
}

function verifyPhoneNumber(number) {
  return new RegExp("^[0-9]{1,14}?$").test(number)
}

onMounted(async () => {
  let paypal;
  try {
    paypal = await loadScript({
      clientId: constants.PAYPAL_CLIENT_ID
    });
  } catch (error) {
    console.error("failed to load the PayPal JS SDK script", error);
  }

  if (paypal) {
    try {
      await paypal
        .Buttons({
          style: {
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "paypal",
          },
          async createOrder() {
            if (hasEmptyString(userInfo)) {
              alert('Please, fill out all the mandatory fields')
              return
            }
            if (!verifyEmail(userInfo.email_address)) {
              alert('Please, write a valid email')
              return
            }
            if (!verifyPhoneNumber(userInfo.phone.phone_number.national_number)) {
              alert('Please, write a valid phone number')
              return
            }
            try {
              const response = await fetch(
                `${import.meta.env.VITE_API_URL}/api/orders`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body: JSON.stringify({
                    cart: productsInCart,
                    payer: userInfo
                  }),
                }
              );

              const orderData = await response.json();

              if (!orderData.id) {
                const errorDetail =
                  orderData.details[0];
                const errorMessage = errorDetail
                  ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
                  : "Unexpected error occurred, please try again.";

                throw new Error(errorMessage);
              }

              return orderData.id;
            } catch (error) {
              console.error(error);
              throw error;
            }
          },
          async onApprove(data, actions) {
            try {
              const response = await fetch(`${import.meta.env.VITE_API_URL}/api/orders/${data.orderID}/capture`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
              });

              const orderData = await response.json();

              const errorDetail = orderData?.details?.[0];

              if (errorDetail?.issue === "INSTRUMENT_DECLINED") {
                return actions.restart();
              } else if (errorDetail) {
                throw new Error(`${errorDetail.description} (${orderData.debug_id})`);
              } else if (!orderData.purchase_units) {
                throw new Error(JSON.stringify(orderData));
              } else {
                const transaction =
                  orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
                  orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];
                resultMessage(
                  `Transaction ${transaction.status}: ${transaction.id}
                  Thanks for your purchase`
                );
                console.log(
                  "Capture result",
                  orderData,
                  JSON.stringify(orderData, null, 2)
                );
              }
            } catch (error) {
              console.error(error);
              resultMessage(
                `Sorry, your transaction could not be processed...<br><br>${error}`
              );
            }
          },
        })
        .render("#paypal-button-container");
    } catch (error) {
      console.error("failed to render the PayPal Buttons", error);
    }
  }
})
</script>

<template>
  <div>
    <h3>Producs In Your Cart:</h3>
    <table>
      <thead>
        <tr>
          <th>
            Product ID
          </th>
          <th>
            Product name
          </th>
          <th>
            Quantity
          </th>
          <th>
            Price (USD)
          </th>
          <th>
            Action
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="product in productsInCart" :key="product.id">
          <td>{{ product.id }}</td>
          <td>{{ product.name }}</td>
          <td>{{ product.quantity }}</td>
          <td>{{ product.price }}</td>
          <td>
            <button v-on:click="removeOne(product)">Remove One</button>
            <button v-on:click="addOne(product)">Add One</button>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th id="total" colspan="3">Total :</th>
          <td>{{ total }}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div>
    <h3>Your Information:</h3>
    <div class="form">
      <div class="info_left">
        <label for="given_name"><span style="color: red">*</span> Name: </label>
        <input type="text" v-model="userInfo.name.given_name" id="given_name"><br><br>
        <label for="surname"><span style="color: red">*</span>Surname: </label>
        <input type="text" v-model="userInfo.name.surname" id="surname"><br><br>
        <label for="email_address"><span style="color: red">*</span>Email Address: </label>
        <input type="text" v-model="userInfo.email_address" id="email_address"><br><br>
        <label for="phone_type"><span style="color: red">*</span>Phone Type: </label>
        <select v-model="userInfo.phone.phone_type" id="phone_type">
          <option v-for="pt in constants.phone_types" :key="pt" :value="pt">{{ pt }}</option>
        </select><br><br>
        <label for="national_number"><span style="color: red">*</span>Phone Number: </label>
        <input type="text" v-model="userInfo.phone.phone_number.national_number" id="national_number"><br><br>
      </div>
      <div class="info_right">
        <label for="address_line_1"><span style="color: red">*</span>Address Line 1: </label>
        <input type="text" v-model="userInfo.address.address_line_1" id="address_line_1"><br><br>
        <label for="address_line_2"><span style="color: red">*</span>Address Line 2: </label>
        <input type="text" v-model="userInfo.address.address_line_2" id="address_line_2"><br><br>
        <label for="admin_area_1"><span style="color: red">*</span>State: </label>
        <select v-model="userInfo.address.admin_area_1" id="admin_area_1">
          <option v-for="state in constants.states" :key="state.abbreviation" :value="state.abbreviation">{{ state.name
            }}
          </option>
        </select><br><br>
        <label for="admin_area_2"><span style="color: red">*</span>City: </label>
        <input type="text" v-model="userInfo.address.admin_area_2" id="admin_area_2"><br><br>
        <label for="postal_code"><span style="color: red">*</span>Postal Code: </label>
        <input type="text" v-model="userInfo.address.postal_code" id="postal_code"><br><br>
        <label for="country_code"><span style="color: red">*</span>Country: </label>
        <select v-model="userInfo.address.country_code" id="country_code">
          <option value="US">United States</option>
        </select><br><br>
      </div>
    </div>
  </div>
  <div id="paypal-button-container"></div>
</template>

<style scoped>
table {
  border-collapse: collapse;
  margin-bottom: 50px;
}

th,
td {
  border: 1px solid #7a3f3f;
  padding: 10px;
  text-align: center;
}

.form {
  width: 100%;
  overflow: hidden;
}

.info_left {
  width: 300px;
  float: left;
}

.info_right {
  margin-left: 320px;
}
</style>