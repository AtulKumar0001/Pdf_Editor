<script>
    import { createEventDispatcher } from "svelte";
    import { pannable } from "./utils/pannable.js";
    
    export let type = "blur"; // or "erase"
    export let x;
    export let y;
    export let width;
    export let height;
    export let pageScale = 1;
    
    const dispatch = createEventDispatcher();
    let startX;
    let startY;
    let dx = 0;
    let dy = 0;
    let dw = 0;
    let dh = 0;
    let operation = "";
    let direction = "";
  
    function handlePanStart(event) {
      startX = event.detail.x;
      startY = event.detail.y;
      
      // Check if clicking on resize handle or main area
      const target = event.detail.target;
      if (target.dataset.direction) {
        operation = "scale";
        direction = target.dataset.direction;
      } else {
        operation = "move";
      }
    }
  
    function handlePanMove(event) {
      if (!operation) return;
      
      const _dx = (event.detail.x - startX) / pageScale;
      const _dy = (event.detail.y - startY) / pageScale;
      
      if (operation === "move") {
        dx = _dx;
        dy = _dy;
      } else if (operation === "scale") {
        switch (direction) {
          case "right-bottom":
            dw = _dx;
            dh = _dy;
            break;
          case "left-top":
            dx = _dx;
            dy = _dy;
            dw = -_dx;
            dh = -_dy;
            break;
        }
      }
    }
  
    function handlePanEnd() {
      if (!operation) return;
      
      if (operation === "move") {
        dispatch("update", {
          x: x + dx,
          y: y + dy
        });
      } else if (operation === "scale") {
        dispatch("update", {
          x: x + dx,
          y: y + dy,
          width: Math.max(50, width + dw),  // Minimum width of 50
          height: Math.max(20, height + dh)  // Minimum height of 20
        });
      }
      
      // Reset all deltas
      dx = 0;
      dy = 0;
      dw = 0;
      dh = 0;
      operation = "";
    }
  
    function onDelete() {
      dispatch("delete");
    }
  </script>
  
  <div
    class="absolute left-0 top-0 select-none"
    style="width: {width + dw}px; height: {height + dh}px; transform: translate({x + dx}px, {y + dy}px);">
    
    <div
      use:pannable
      on:panstart={handlePanStart}
      on:panmove={handlePanMove}
      on:panend={handlePanEnd}
      class="absolute w-full h-full cursor-move border-2 border-dashed"
      class:border-blue-500={type === 'blur'}
      class:border-red-500={type === 'erase'}>
      
      <div
        class="absolute w-full h-full"
        style="
          {type === 'blur' 
            ? 'backdrop-filter: blur(3px); background: rgba(200, 200, 200, 0.1);' 
            : 'background: white; mix-blend-mode: multiply;'
          }">
      </div>
  
      <!-- Resize handles -->
      <div
        data-direction="left-top"
        class="absolute left-0 top-0 w-6 h-6 bg-white border-2 rounded-full cursor-nwse-resize transform -translate-x-1/2 -translate-y-1/2"
        class:border-blue-500={type === 'blur'}
        class:border-red-500={type === 'erase'} />
      
      <div
        data-direction="right-bottom"
        class="absolute right-0 bottom-0 w-6 h-6 bg-white border-2 rounded-full cursor-nwse-resize transform translate-x-1/2 translate-y-1/2"
        class:border-blue-500={type === 'blur'}
        class:border-red-500={type === 'erase'} />
    </div>
  
    <!-- Delete button -->
    <div
      on:click={onDelete}
      class="absolute left-0 top-0 right-0 w-8 h-8 m-auto rounded-full bg-white
      cursor-pointer transform -translate-y-1/2 shadow-lg hover:bg-red-100">
      <img class="w-full h-full p-2" src="/delete.svg" alt="delete object" />
    </div>
  </div>
  
  <style>
    .cursor-move {
      cursor: move;
    }
  </style>