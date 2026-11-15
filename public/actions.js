'use strict';
const safeActions = {
  "action0": (event) => { closeImageModal() },
  "action3": (event) => { confirmAddonTarget() },
  "action4": (event) => { closeAddonModal() },
  "action5": (event) => { resetCart() },
  "action6": (event) => { handleOrderTypeChange() },
  "action7": (event) => { handleDeliveryZoneChange() },
  "action8": (event) => { getCurrentLocationGPS() },
  "action9": (event) => { sendOrderToWhatsApp() },
};
for (const type of ['click','change','submit','input']) {
  document.addEventListener(type, event => {
    const node = event.target.closest(`[data-action-${type}]`);
    const action = node?.getAttribute(`data-action-${type}`);
    if (node && Object.hasOwn(safeActions,action)) safeActions[action](event);
  });
}
document.addEventListener('click', event => {
  const step=event.target.closest('[data-cart-step]');
  if(step) setCartStep(Number(step.dataset.cartStep));
  const category=event.target.closest('[data-scroll-category]');
  if(category)scrollToCategory(event,category.dataset.scrollCategory);
  const add=event.target.closest('[data-menu-add]');
  if(add)handleAddToCart(add.dataset.menuAdd,Number(add.dataset.categoryIndex),Number(add.dataset.itemIndex),add.dataset.featured==='true');
});

