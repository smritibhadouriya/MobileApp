// Loads Razorpay Checkout on demand (only when someone actually buys Pro)
let loading;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your internet and try again."));
    };
    document.head.appendChild(script);
  });
  return loading;
}
