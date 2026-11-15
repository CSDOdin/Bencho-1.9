(()=>{
  window.addEventListener('bencho:config',({detail:c})=>{
    const delivery=document.getElementById('delivery-option');if(delivery){const enabled=!!c.deliveryZones?.length;delivery.hidden=!enabled;delivery.disabled=!enabled;if(!enabled&&delivery.selected){document.getElementById('order-type').value='Pick Up';}}
    const note=document.querySelector('.currency-explainer');if(note&&c.menuData?.every(cat=>cat.items.every(p=>p.price>0)))note.textContent='Todas las hamburguesas incluyen 100 g de papas fritas. Precios en COP; equivalencias según las tasas del restaurante.';
    if(c.restaurant?.cover){const img=document.querySelector('.hero19-visual img');if(img)img.src=c.restaurant.cover;}
  });
})();